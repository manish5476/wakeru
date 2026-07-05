import { logger } from '../../config/logger';
import { config } from '../../config';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { Receipt } from './receipt.model';

// ============================================================
// TYPES
// ============================================================

interface OCRResult {
  success: boolean;
  confidence: number;
  rawText?: string;
  extractedItems?: Array<{
    name: string;
    category: string;
    price: number;
    quantity: number;
    confidence: number;
  }>;
  merchantName?: string;
  merchantAddress?: string;
  date?: Date;
  totalAmount?: number;
  taxAmount?: number;
  currency?: string;
  paymentMethod?: string;
  error?: string;
  provider?: string;
  processingTimeMs?: number;
}

// ============================================================
// OCR PROCESSOR — 100% FREE (Tesseract.js)
// ============================================================

export class OCRProcessor {

  /**
   * Main entry point — process receipt with Tesseract.js
   */
  async processReceipt(receiptId: string, imagePath: string): Promise<OCRResult> {
    const startTime = Date.now();

    try {
      const receipt = await Receipt.findOne({ receiptId });
      if (!receipt) throw new Error('Receipt not found');

      // Update status to processing
      receipt.status = 'PROCESSING';
      receipt.statusHistory.push({
        status: 'PROCESSING',
        timestamp: new Date(),
        message: 'OCR processing started (Tesseract)',
      });
      await receipt.save();

      // Step 1: Create multiple preprocessed versions for better OCR
      const versions = await this.createImageVersions(imagePath);

      // Step 2: Run Tesseract on each version and combine results
      let bestResult: OCRResult = { success: false, confidence: 0, rawText: '' };

      for (const version of versions) {
        const result = await this.processWithTesseract(version);
        if (result.confidence > bestResult.confidence) {
          bestResult = result;
        }
        // Clean up processed version
        await fs.unlink(version).catch(() => {});
      }

      // Step 3: If Tesseract failed, try fallback
      if (!bestResult.success || bestResult.confidence < 0.2) {
        bestResult = await this.fallbackTextExtraction(imagePath);
      }

      // Step 4: Post-process the best result
      if (bestResult.success && bestResult.rawText) {
        bestResult = await this.postProcessResults(bestResult);
      }

      // Step 5: Update receipt
      await this.finalizeReceipt(receipt, bestResult, startTime);

      return bestResult;
    } catch (error) {
      const err = error as Error;
      logger.error('OCR processing failed:', err);

      await Receipt.findOneAndUpdate(
        { receiptId },
        {
          $set: {
            status: 'FAILED',
            'ocrData.processed': true,
            'ocrData.error': err.message,
          },
          $push: {
            statusHistory: {
              status: 'FAILED',
              timestamp: new Date(),
              message: `OCR failed: ${err.message}`,
            },
          },
        }
      );

      return {
        success: false,
        confidence: 0,
        error: err.message,
        processingTimeMs: Date.now() - startTime,
        provider: 'tesseract',
      };
    }
  }

  // ============================================================
  // IMAGE PREPROCESSING — Multiple versions for better OCR
  // ============================================================

  /**
   * Create multiple preprocessed versions of the same image.
   * Different preprocessing works better for different receipt types.
   */
  private async createImageVersions(imagePath: string): Promise<string[]> {
    const baseName = imagePath.replace(/\.[^.]+$/, '');
    const versions: string[] = [];

    try {
      // Version 1: Grayscale + Contrast + Sharpen (best for printed receipts)
      const v1Path = `${baseName}_v1.png`;
      await sharp(imagePath)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .sharpen({ sigma: 1.5 })
        .linear(1.3, -(128 * 0.3))
        .toFile(v1Path);
      versions.push(v1Path);

      // Version 2: Black & White threshold (best for faded receipts)
      const v2Path = `${baseName}_v2.png`;
      await sharp(imagePath)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .grayscale()
        .normalize()
        .threshold(140)
        .toFile(v2Path);
      versions.push(v2Path);

      // Version 3: Original with just resize (for clear photos)
      const v3Path = `${baseName}_v3.png`;
      await sharp(imagePath)
        .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
        .toFile(v3Path);
      versions.push(v3Path);

      logger.info(`Created ${versions.length} image versions for OCR`);
    } catch (error) {
      logger.error('Image preprocessing failed:', error);
      // Return original if preprocessing fails
      versions.push(imagePath);
    }

    return versions;
  }

  // ============================================================
  // TESSERACT OCR
  // ============================================================

  private async processWithTesseract(imagePath: string): Promise<OCRResult> {
    try {
      const { createWorker } = await import('tesseract.js');

      const worker = await createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text') {
            logger.debug(`Tesseract: ${Math.round((m.progress || 0) * 100)}%`);
          }
        },
      });

      // Best settings for receipts
      await worker.setParameters({
        tessedit_pageseg_mode: '6' as any,
        preserve_interword_spaces: '1',
      });

      const { data } = await worker.recognize(imagePath);
      await worker.terminate();

      const confidence = data.confidence / 100;
      logger.info(`Tesseract confidence: ${(confidence * 100).toFixed(1)}%`);

      return {
        success: data.text.length > 10,
        confidence,
        rawText: data.text,
        extractedItems: [],
        provider: 'tesseract',
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Tesseract failed:', err.message);
      return {
        success: false,
        confidence: 0,
        error: err.message,
        provider: 'tesseract',
      };
    }
  }

  // ============================================================
  // FALLBACK: Basic image analysis when OCR fails
  // ============================================================

  private async fallbackTextExtraction(imagePath: string): Promise<OCRResult> {
    logger.info('Tesseract failed, trying basic image analysis...');
    
    try {
      // Get image metadata for size estimation
      const metadata = await sharp(imagePath).metadata();
      
      return {
        success: true,
        confidence: 0.1,
        rawText: '',
        extractedItems: [{
          name: 'Receipt',
          category: 'other',
          price: 0,
          quantity: 1,
          confidence: 0.1,
        }],
        provider: 'fallback',
      };
    } catch {
      return {
        success: false,
        confidence: 0,
        error: 'All OCR methods failed',
        provider: 'fallback',
      };
    }
  }

  // ============================================================
  // POST-PROCESSING — Extract structured data from raw text
  // ============================================================

  private async postProcessResults(ocrResult: OCRResult): Promise<OCRResult> {
    if (!ocrResult.rawText || ocrResult.rawText.trim().length < 5) {
      return ocrResult;
    }

    const lines = ocrResult.rawText
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0);

    logger.info(`OCR extracted ${lines.length} lines of text`);

    // Extract everything
    ocrResult.merchantName = this.extractMerchantName(lines);
    ocrResult.merchantAddress = this.extractMerchantAddress(lines);
    ocrResult.date = this.extractDate(lines);
    ocrResult.totalAmount = this.extractTotalAmount(lines);
    ocrResult.taxAmount = this.extractTaxAmount(lines);
    ocrResult.currency = this.extractCurrency(ocrResult.rawText);
    ocrResult.paymentMethod = this.extractPaymentMethod(ocrResult.rawText);
    ocrResult.extractedItems = this.extractLineItems(lines);

    // Categorize items
    ocrResult.extractedItems = this.categorizeItems(ocrResult.extractedItems || []);

    // If no items found but we have a total, create single item
    if ((!ocrResult.extractedItems || ocrResult.extractedItems.length === 0) && ocrResult.totalAmount && ocrResult.totalAmount > 0) {
      const category = this.categorizeIndianMerchant(ocrResult.merchantName || '', lines);
      ocrResult.extractedItems = [{
        name: ocrResult.merchantName || 'Receipt Purchase',
        category: category || 'other',
        price: ocrResult.totalAmount,
        quantity: 1,
        confidence: 0.6,
      }];
    }

    logger.info(`Post-processing complete: merchant="${ocrResult.merchantName}", total=${ocrResult.totalAmount}, items=${ocrResult.extractedItems?.length || 0}`);

    return ocrResult;
  }

  // ============================================================
  // EXTRACTION METHODS
  // ============================================================

  private extractMerchantName(lines: string[]): string {
    // Skip very short lines
    const candidates = lines.filter(l => l.length > 3 && l.length < 60);

    // Strategy 1: Look for GSTIN and get name from nearby lines
    for (let i = 0; i < lines.length; i++) {
      if (/GSTIN|GST NO|GST Number/i.test(lines[i])) {
        // Check line above
        for (let j = i - 1; j >= Math.max(0, i - 3); j--) {
          const line = lines[j].trim();
          if (line.length > 3 && line.length < 50 && !/^\d|total|date|bill|invoice|tax|cash|card|upi/i.test(line)) {
            return line;
          }
        }
      }
    }

    // Strategy 2: Look for business indicators
    const businessPatterns = [
      /(restaurant|cafe|hotel|dhaba|store|mart|shop|pharmacy|hospital|clinic)/i,
      /^(?:welcome to|thank you for visiting)\s+(.+)/i,
      /^([A-Z][A-Za-z\s&\.'-]{4,40})$/,
    ];

    for (const line of candidates.slice(0, 8)) {
      for (const pattern of businessPatterns) {
        const match = line.match(pattern);
        if (match) {
          const name = (match[1] || match[0]).trim();
          if (name.length > 3) return name;
        }
      }
    }

    // Strategy 3: Return the longest meaningful line from top of receipt
    const topLines = candidates.slice(0, 5);
    const longestLine = topLines.reduce((a, b) => a.length > b.length ? a : b, '');
    
    if (longestLine.length > 3 && !/^\d|date|bill|invoice|total/i.test(longestLine)) {
      return longestLine.substring(0, 50);
    }

    return candidates[0]?.substring(0, 50) || 'Unknown Merchant';
  }

  private extractMerchantAddress(lines: string[]): string {
    const addressPatterns = [
      /(\d+[,\s]+[A-Za-z\s]+(?:road|street|lane|nagar|colony|market|complex|tower|building|floor|sector|phase))/i,
      /([A-Za-z\s]+,\s*[A-Za-z\s]+[-]?\d{5,6})/,
      /(pin\s*(?:code)?[:\s]*\d{5,6})/i,
    ];

    for (const line of lines) {
      for (const pattern of addressPatterns) {
        const match = line.match(pattern);
        if (match) return match[1].trim();
      }
    }

    // Look for line containing city names
    const cities = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai', 'kolkata', 'hyderabad', 'pune', 'ahmedabad', 'jaipur', 'goa', 'kochi'];
    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (cities.some(city => lowerLine.includes(city)) && line.length > 10 && line.length < 100) {
        return line.trim();
      }
    }

    return '';
  }

  private extractDate(lines: string[]): Date | undefined {
    const datePatterns = [
      // DD/MM/YYYY or DD-MM-YYYY
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
      // DD.MM.YYYY
      /(\d{1,2}\.\d{1,2}\.\d{4})/,
      // YYYY-MM-DD
      /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      // Date: DD/MM/YYYY
      /(?:date|dt)[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      // Bill Date
      /bill\s*date[\s:]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          const dateStr = match[1];
          const date = this.parseDate(dateStr);
          if (date && this.isValidReceiptDate(date)) return date;
        }
      }
    }

    return undefined;
  }

  private parseDate(dateStr: string): Date | null {
    const parts = dateStr.split(/[\/\-\.]/);
    
    if (parts.length !== 3) return null;
    
    const p1 = parseInt(parts[0]);
    const p2 = parseInt(parts[1]);
    const p3 = parseInt(parts[2]);

    // Handle YYYY-MM-DD
    if (p1 > 2000 && p1 < 2100) {
      return new Date(p1, p2 - 1, p3);
    }
    
    // Handle DD/MM/YYYY (Indian format)
    // If first part > 12, it's definitely a day
    if (p1 > 12 && p1 <= 31 && p2 <= 12) {
      return new Date(p3, p2 - 1, p1);
    }
    
    // If second part > 12, first is month
    if (p2 > 12 && p2 <= 31 && p1 <= 12) {
      return new Date(p3, p1 - 1, p2);
    }

    // Default: assume DD/MM/YYYY for Indian receipts
    return new Date(p3, p2 - 1, p1);
  }

  private isValidReceiptDate(date: Date): boolean {
    if (isNaN(date.getTime())) return false;
    const year = date.getFullYear();
    return year >= 2020 && year <= new Date().getFullYear() + 1;
  }

  private extractTotalAmount(lines: string[]): number {
    const totalPatterns = [
      /grand\s*total[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /total[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /amount\s*(?:due|payable)?[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /bill\s*amount[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /net\s*amount[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /to\s*pay[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /[₹$€£]\s*(\d{2,}[\.\,]\d{2})\s*$/,
      /(\d{2,}[\.\,]\d{2})\s*$/,
    ];

    // Search from bottom (totals usually at bottom)
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          const amount = parseFloat(match[1].replace(/,/g, ''));
          if (amount > 0 && amount < 1000000) return amount;
        }
      }
    }

    // Fallback: largest number ending in .00 or .X0
    const amounts = lines
      .map(line => {
        const match = line.match(/(\d{2,}[\.\,]\d{2})/);
        return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
      })
      .filter(a => a > 0 && a < 1000000)
      .sort((a, b) => b - a);

    return amounts[0] || 0;
  }

  private extractTaxAmount(lines: string[]): number {
    const taxPatterns = [
      /cgst\s*(?:@?\s*\d+%?\s*)?[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /sgst\s*(?:@?\s*\d+%?\s*)?[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /igst\s*(?:@?\s*\d+%?\s*)?[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /gst\s*(?:@?\s*\d+%?\s*)?[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
      /(?:service\s*)?tax\s*(?:@?\s*\d+%?\s*)?[\s:]*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
    ];

    let totalTax = 0;

    for (const line of lines) {
      for (const pattern of taxPatterns) {
        const match = line.match(pattern);
        if (match) {
          totalTax += parseFloat(match[1].replace(/,/g, ''));
        }
      }
    }

    return totalTax;
  }

  private extractCurrency(text: string): string {
    if (text.includes('₹') || /rs\./i.test(text) || /inr/i.test(text)) return 'INR';
    if (text.includes('$') || /usd/i.test(text)) return 'USD';
    if (text.includes('€') || /eur/i.test(text)) return 'EUR';
    if (text.includes('£') || /gbp/i.test(text)) return 'GBP';
    return 'INR';
  }

  private extractPaymentMethod(text: string): string {
    const lower = text.toLowerCase();
    
    if (lower.includes('upi') || lower.includes('gpay') || lower.includes('phonepe') || lower.includes('paytm')) return 'UPI';
    if (lower.includes('card') || lower.includes('visa') || lower.includes('mastercard') || lower.includes('rupay')) return 'Card';
    if (lower.includes('cash')) return 'Cash';
    if (lower.includes('net banking') || lower.includes('neft') || lower.includes('imps')) return 'Net Banking';
    
    return '';
  }

  private extractLineItems(lines: string[]): Array<{
    name: string;
    category: string;
    price: number;
    quantity: number;
    confidence: number;
  }> {
    const items: Array<{
      name: string;
      category: string;
      price: number;
      quantity: number;
      confidence: number;
    }> = [];

    // Skip lines that are headers/totals
    const skipPatterns = /total|grand|subtotal|tax|gst|cgst|sgst|igst|discount|round|change|tender|cash|card|upi|thank|visit|bill|invoice|date|time|gstin|sac|hsn|item|qty|rate|amount|particulars|description/i;

    const itemPatterns = [
      // "Item Name    2 x 150.00 = 300.00"
      /^(.+?)\s+(\d+)\s*[xX]\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/,
      // "Item Name    2    150.00    300.00"
      /^(.+?)\s+(\d+)\s+[₹$€£]?\s*(\d+[\.\,]\d{2})/,
      // "Item Name    150.00"
      /^(.+?)\s+[₹$€£]?\s*(\d+[\.\,]\d{2})\s*$/,
    ];

    for (const line of lines) {
      if (skipPatterns.test(line)) continue;
      if (line.length < 5 || line.length > 100) continue;

      for (const pattern of itemPatterns) {
        const match = line.match(pattern);
        if (match) {
          const name = match[1].trim();
          if (name.length < 2 || /^\d+$/.test(name)) continue;

          items.push({
            name: name.substring(0, 80),
            category: 'other',
            price: parseFloat((match[3] || match[2]).replace(/,/g, '')),
            quantity: match[2] && !isNaN(parseInt(match[2])) ? parseInt(match[2]) : 1,
            confidence: 0.5,
          });
          break;
        }
      }
    }

    return items;
  }

  // ============================================================
  // CATEGORIZATION
  // ============================================================

  private categorizeItems(items: Array<{
    name: string;
    category: string;
    price: number;
    quantity: number;
    confidence: number;
  }>): Array<{
    name: string;
    category: string;
    price: number;
    quantity: number;
    confidence: number;
  }> {
    const CATEGORY_KEYWORDS: Record<string, string[]> = {
      'food': [
        'pizza', 'burger', 'sandwich', 'salad', 'pasta', 'rice', 'biryani',
        'curry', 'dal', 'roti', 'naan', 'paneer', 'chicken', 'mutton', 'fish',
        'dosa', 'idli', 'vada', 'samosa', 'chai', 'coffee', 'tea', 'drink',
        'juice', 'water', 'soda', 'beer', 'wine', 'cocktail', 'dessert',
        'ice cream', 'cake', 'sweet', 'snack', 'breakfast', 'lunch', 'dinner',
        'meal', 'combo', 'thali', 'starter', 'appetizer', 'tandoori', 'kebab',
        'paratha', 'puri', 'bhaji', 'pav', 'bhel', 'chaat', 'roll', 'wrap',
        'momo', 'noodle', 'soup', 'fries', 'shake', 'lassi', 'mocktail',
      ],
      'transport': [
        'uber', 'ola', 'rapido', 'taxi', 'cab', 'auto', 'rickshaw',
        'bus', 'train', 'metro', 'flight', 'fuel', 'petrol', 'diesel',
        'parking', 'toll', 'fastag',
      ],
      'stay': [
        'hotel', 'room', 'resort', 'hostel', 'airbnb', 'lodge', 'inn',
        'suite', 'accommodation', 'check-in', 'check-out', 'night stay',
      ],
      'shopping': [
        'shirt', 'pant', 'dress', 'shoe', 'bag', 'watch', 'jewelry',
        'phone', 'laptop', 'charger', 'cable', 'book', 'pen', 'notebook',
        'grocery', 'vegetable', 'fruit', 'milk', 'bread', 'egg', 'rice',
        'flour', 'oil', 'sugar', 'spice', 'soap', 'shampoo', 'toothpaste',
        'detergent', 'cleaner', 'tissue', 'water bottle',
      ],
      'health': [
        'medicine', 'tablet', 'capsule', 'syrup', 'doctor', 'hospital',
        'clinic', 'pharmacy', 'test', 'scan', 'x-ray', 'consultation',
        'vitamin', 'supplement', 'bandage', 'ointment', 'cream',
      ],
      'activity': [
        'movie', 'ticket', 'show', 'concert', 'museum', 'zoo', 'park',
        'game', 'sport', 'gym', 'pool', 'spa', 'massage', 'tour',
        'trek', 'hike', 'camp', 'adventure', 'amusement',
      ],
    };

    return items.map(item => {
      const nameLower = item.name.toLowerCase();

      for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        if (keywords.some(kw => nameLower.includes(kw))) {
          return { ...item, category, confidence: Math.max(item.confidence, 0.8) };
        }
      }

      return item;
    });
  }

  private categorizeIndianMerchant(merchantName: string, lines: string[]): string | null {
    const allText = [merchantName, ...lines].join(' ').toLowerCase();

    const MERCHANT_CATEGORIES: Record<string, string[]> = {
      'food': [
        'restaurant', 'cafe', 'coffee', 'hotel', 'dhaba', 'canteen',
        'biryani', 'swiggy', 'zomato', 'mcdonalds', 'mcdonald', 'kfc',
        'dominos', 'pizza hut', 'starbucks', 'chaayos', 'chai point',
        'haldiram', 'bikaner', 'barbeque', 'grill', 'dine', 'diner',
        'bakery', 'sweets', 'food court', 'food plaza', 'refreshment',
        'subway', 'burger king', 'wendy', 'taco bell', 'dunkin',
        'cream stone', 'baskin robbins', 'natural', 'amul',
      ],
      'transport': [
        'uber', 'ola', 'rapido', 'irctc', 'railway', 'metro', 'bus',
        'indian oil', 'bharat petroleum', 'hp petrol', 'fuel station',
        'toll plaza', 'parking', 'airlines', 'airport', 'indigo',
        'spicejet', 'vistara', 'air india', 'makemytrip', 'goibibo',
        'redbus', 'ixigo',
      ],
      'shopping': [
        'mart', 'store', 'bazaar', 'mall', 'amazon', 'flipkart',
        'myntra', 'ajio', 'bigbasket', 'dmart', 'd-mart', 'reliance',
        'hypermarket', 'supermarket', 'wholesale', 'retail',
        'croma', 'vijay sales', 'lifestyle', 'shoppers stop',
        'pantaloons', 'westside', 'zara', 'h&m',
      ],
      'health': [
        'hospital', 'clinic', 'pharmacy', 'medical', 'diagnostic',
        'apollo', 'fortis', 'max healthcare', 'medanta', 'aiims',
        'pathology', 'lab', 'medplus', 'pharmeasy', 'netmeds',
        '1mg', 'practo',
      ],
      'activity': [
        'cinema', 'pvr', 'inox', 'cinepolis', 'bookmyshow',
        'museum', 'zoo', 'park', 'ticket', 'entry', 'show',
        'concert', 'stadium', 'club', 'lounge', 'pub', 'bar',
      ],
    };

    for (const [category, keywords] of Object.entries(MERCHANT_CATEGORIES)) {
      if (keywords.some(kw => allText.includes(kw))) {
        return category;
      }
    }

    return null;
  }

  // ============================================================
  // FINALIZE
  // ============================================================

  private async finalizeReceipt(
    receipt: any,
    ocrResult: OCRResult,
    startTime: number
  ): Promise<void> {
    const processingTime = Date.now() - startTime;

    receipt.ocrData = {
      processed: true,
      confidence: ocrResult.confidence,
      rawText: ocrResult.rawText,
      extractedItems: ocrResult.extractedItems || [],
      merchantName: ocrResult.merchantName,
      merchantAddress: ocrResult.merchantAddress,
      date: ocrResult.date,
      totalAmount: ocrResult.totalAmount,
      taxAmount: ocrResult.taxAmount,
      currency: ocrResult.currency,
      paymentMethod: ocrResult.paymentMethod,
      error: ocrResult.error,
      provider: 'tesseract',
    } as any;

    receipt.status = ocrResult.success ? 'COMPLETED' : 'FAILED';
    receipt.statusHistory.push({
      status: receipt.status,
      timestamp: new Date(),
      message: ocrResult.success
        ? `OCR completed in ${processingTime}ms (confidence: ${(ocrResult.confidence * 100).toFixed(0)}%)`
        : `OCR failed: ${ocrResult.error}`,
    });

    receipt.markModified('ocrData');
    await receipt.save();
  }
}

export const ocrProcessor = new OCRProcessor();



//--------------------------------------------------------------------------------------------gemini version ai 
//  import { logger } from '../../config/logger';
// import { config } from '../../config';
// import sharp from 'sharp';
// import path from 'path';
// import fs from 'fs/promises';
// import { Receipt } from './receipt.model';
// import { Types } from 'mongoose';

// // ============================================================
// // TYPES
// // ============================================================

// interface OCRResult {
//   success: boolean;
//   confidence: number;
//   rawText?: string;
//   extractedItems?: Array<{
//     name: string;
//     category: string;
//     price: number;
//     quantity: number;
//     confidence: number;
//   }>;
//   merchantName?: string;
//   merchantAddress?: string;
//   date?: Date;
//   totalAmount?: number;
//   taxAmount?: number;
//   currency?: string;
//   paymentMethod?: string;
//   error?: string;
//   provider?: string; // Which OCR engine was used
//   processingTimeMs?: number;
// }

// // ============================================================
// // OCR PROCESSOR CLASS
// // ============================================================

// export class OCRProcessor {
  
//   /**
//    * Main entry point — tries multiple OCR engines in order of preference
//    */
//   async processReceipt(receiptId: string, imagePath: string): Promise<OCRResult> {
//     const startTime = Date.now();
    
//     try {
//       const receipt = await Receipt.findOne({ receiptId });
//       if (!receipt) throw new Error('Receipt not found');

//       // Update status
//       receipt.status = 'PROCESSING';
//       receipt.statusHistory.push({
//         status: 'PROCESSING',
//         timestamp: new Date(),
//         message: 'OCR processing started',
//       });
//       await receipt.save();

//       // Step 1: Preprocess image
//       const processedImagePath = await this.preprocessImage(imagePath);

//       // Step 2: Try OCR engines in order
//       let ocrResult: OCRResult;

//       // Try Gemini first (FREE tier — 1500 req/day)
//       if (config.GEMINI_API_KEY) {
//         try {
//           ocrResult = await this.processWithGemini(processedImagePath);
//           if (ocrResult.success) {
//             ocrResult = await this.postProcessResults(ocrResult);
//             await this.finalizeReceipt(receipt, ocrResult, true, startTime);
//             await fs.unlink(processedImagePath).catch(() => {});
//             return ocrResult;
//           }
//         } catch (err) {
//           logger.warn('Gemini OCR failed, falling back to Tesseract:', err);
//         }
//       }

//       // Fallback: Tesseract (completely free, no API key needed)
//       ocrResult = await this.processWithTesseract(processedImagePath);

//       // Step 3: Post-process
//       if (ocrResult.success) {
//         ocrResult = await this.postProcessResults(ocrResult);
//       }

//       // Step 4: Update receipt
//       await this.finalizeReceipt(receipt, ocrResult, true, startTime);

//       // Cleanup
//       await fs.unlink(processedImagePath).catch(() => {});

//       return ocrResult;
//     } catch (error) {
//       const err = error as Error;
//       logger.error('OCR processing failed:', err);

//       await Receipt.findOneAndUpdate(
//         { receiptId },
//         {
//           $set: {
//             status: 'FAILED',
//             'ocrData.processed': true,
//             'ocrData.error': err.message,
//           },
//           $push: {
//             statusHistory: {
//               status: 'FAILED',
//               timestamp: new Date(),
//               message: `OCR failed: ${err.message}`,
//             },
//           },
//         }
//       );

//       return {
//         success: false,
//         confidence: 0,
//         error: err.message,
//         processingTimeMs: Date.now() - startTime,
//       };
//     }
//   }

//   // ============================================================
//   // IMAGE PREPROCESSING
//   // ============================================================

//   private async preprocessImage(imagePath: string): Promise<string> {
//     const outputPath = imagePath.replace(/\.[^.]+$/, '_processed.png');

//     // Create multiple versions for different OCR engines
//     await sharp(imagePath)
//       .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
//       .grayscale()
//       .normalize()
//       .sharpen({ sigma: 1.5 })
//       .linear(1.2, -(128 * 0.2)) // Increase contrast
//       .toFile(outputPath);

//     return outputPath;
//   }

//   // ============================================================
//   // OCR ENGINE 1: GOOGLE GEMINI (FREE TIER)
//   // ============================================================

//   /**
//    * Google Gemini Flash — FREE: 1,500 requests/day
//    * Get API key: https://aistudio.google.com/apikey
//    * 
//    * Gemini is excellent at understanding receipt structure
//    * and extracting structured data from unstructured text.
//    */
//   private async processWithGemini(imagePath: string): Promise<OCRResult> {
//     try {
//       logger.info('🟡 Processing with Google Gemini (FREE tier)');

//       const imageBuffer = await fs.readFile(imagePath);
//       const base64Image = imageBuffer.toString('base64');

//       const prompt = `Analyze this receipt image and extract the following information in JSON format.
// Return ONLY valid JSON, no other text.

// {
//   "merchantName": "Store/Restaurant name",
//   "merchantAddress": "Full address if visible",
//   "date": "Receipt date in YYYY-MM-DD format",
//   "totalAmount": total as number (without currency symbol),
//   "taxAmount": total tax as number (add CGST+SGST for India),
//   "currency": "INR" or "USD" etc.,
//   "paymentMethod": "CASH" or "CARD" or "UPI" etc.,
//   "items": [
//     {
//       "name": "Item name",
//       "category": "food/drink/grocery/other",
//       "price": price per unit as number,
//       "quantity": quantity as number
//     }
//   ]
// }

// For Indian receipts:
// - CGST and SGST are usually equal amounts — combine them for taxAmount
// - Look for "Grand Total" or "Total Amount" for totalAmount
// - UPI payment is common — look for UPI transaction ID
// - GSTIN number indicates a registered business

// If you can't determine a field, set it to null or empty array.`;

//       const response = await fetch(
//         `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.GEMINI_API_KEY}`,
//         {
//           method: 'POST',
//           headers: { 'Content-Type': 'application/json' },
//           body: JSON.stringify({
//             contents: [{
//               parts: [
//                 { text: prompt },
//                 { inline_data: { mime_type: 'image/png', data: base64Image } },
//               ],
//             }],
//             generationConfig: {
//               temperature: 0.1, // Low temp for accuracy
//               maxOutputTokens: 2048,
//             },
//           }),
//         }
//       );

//       const result = await response.json() as any;
      
//       if (result.error) {
//         throw new Error(`Gemini API error: ${result.error.message}`);
//       }

//       const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
//       // Extract JSON from response
//       const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
//       if (!jsonMatch) {
//         throw new Error('No JSON found in Gemini response');
//       }

//       const parsed = JSON.parse(jsonMatch[0]);

//       return {
//         success: true,
//         confidence: 0.95, // Gemini is highly accurate
//         rawText: textResponse,
//         extractedItems: (parsed.items || []).map((item: any) => ({
//           name: item.name || 'Unknown Item',
//           category: item.category || 'other',
//           price: parseFloat(item.price) || 0,
//           quantity: parseInt(item.quantity) || 1,
//           confidence: 0.9,
//         })),
//         merchantName: parsed.merchantName || undefined,
//         merchantAddress: parsed.merchantAddress || undefined,
//         date: parsed.date ? new Date(parsed.date) : undefined,
//         totalAmount: parseFloat(parsed.totalAmount) || 0,
//         taxAmount: parseFloat(parsed.taxAmount) || 0,
//         currency: parsed.currency || 'INR',
//         paymentMethod: parsed.paymentMethod || undefined,
//         provider: 'gemini',
//       };
//     } catch (error) {
//       const err = error as Error;
//       logger.warn('Gemini OCR failed:', err.message);
//       return { success: false, confidence: 0, error: err.message, provider: 'gemini' };
//     }
//   }

//   // ============================================================
//   // OCR ENGINE 2: TESSERACT.JS (COMPLETELY FREE)
//   // ============================================================

//   /**
//    * Tesseract.js — 100% FREE, no API key, works offline
//    * Good for clear, well-lit receipts
//    */
//   private async processWithTesseract(imagePath: string): Promise<OCRResult> {
//     try {
//       logger.info('🔵 Processing with Tesseract OCR (free)');

//       const { createWorker } = await import('tesseract.js');

//       // Create worker with English support
//       const worker = await createWorker('eng', 1, {
//         logger: (m: any) => {
//           if (m.status === 'recognizing text') {
//             logger.debug(`Tesseract progress: ${Math.round((m.progress || 0) * 100)}%`);
//           }
//         },
//       });

//       // Best settings for receipts
//       await worker.setParameters({
//         tessedit_pageseg_mode: '6' as any, // Assume uniform block of text
//         preserve_interword_spaces: '1',
//         tessedit_char_whitelist: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,;:!?@#$%^&*()_+-=[]{}|\\\'\"<>/~` \n\r₹$€£¥',
//       });

//       const { data } = await worker.recognize(imagePath);
//       await worker.terminate();

//       const confidence = data.confidence / 100;

//       logger.info(`Tesseract complete. Confidence: ${(confidence * 100).toFixed(1)}%`);

//       return {
//         success: confidence > 0.3, // Lower threshold for Tesseract
//         confidence,
//         rawText: data.text,
//         extractedItems: [],
//         provider: 'tesseract',
//       };
//     } catch (error) {
//       const err = error as Error;
//       logger.error('Tesseract OCR failed:', err);
//       return {
//         success: false,
//         confidence: 0,
//         error: err.message,
//         provider: 'tesseract',
//       };
//     }
//   }

//   // ============================================================
//   // POST-PROCESSING
//   // ============================================================

//   private async postProcessResults(ocrResult: OCRResult): Promise<OCRResult> {
//     if (!ocrResult.rawText && !ocrResult.extractedItems?.length) {
//       return ocrResult;
//     }

//     const lines = (ocrResult.rawText || '').split('\n').filter(line => line.trim());

//     // Only extract from raw text if Gemini didn't already provide structured data
//     if (!ocrResult.merchantName) {
//       ocrResult.merchantName = this.extractMerchantName(lines);
//     }
//     if (!ocrResult.date) {
//       ocrResult.date = this.extractDate(lines);
//     }
//     if (!ocrResult.totalAmount || ocrResult.totalAmount === 0) {
//       ocrResult.totalAmount = this.extractTotalAmount(lines);
//     }
//     if (!ocrResult.taxAmount || ocrResult.taxAmount === 0) {
//       ocrResult.taxAmount = this.extractTaxAmount(lines);
//     }
//     if (!ocrResult.currency) {
//       ocrResult.currency = this.extractCurrency(lines);
//     }

//     // If no items from Gemini, extract from raw text
//     if (!ocrResult.extractedItems?.length) {
//       ocrResult.extractedItems = this.extractLineItems(lines);
//     }

//     // Categorize items
//     ocrResult.extractedItems = this.categorizeItems(ocrResult.extractedItems || []);

//     // Indian merchant auto-categorization
//     if (!ocrResult.extractedItems?.length && ocrResult.merchantName) {
//       const merchantCategory = this.categorizeIndianMerchant(
//         ocrResult.merchantName,
//         lines
//       );
//       if (merchantCategory && ocrResult.totalAmount) {
//         ocrResult.extractedItems = [{
//           name: ocrResult.merchantName || 'Purchase',
//           category: merchantCategory,
//           price: ocrResult.totalAmount,
//           quantity: 1,
//           confidence: 0.7,
//         }];
//       }
//     }

//     return ocrResult;
//   }

//   // ============================================================
//   // EXTRACTION HELPERS
//   // ============================================================

//   private extractMerchantName(lines: string[]): string {
//     // Skip empty first lines
//     const nonEmptyLines = lines.filter(l => l.trim().length > 2);
    
//     // Look for GSTIN pattern (Indian businesses)
//     for (const line of lines) {
//       if (/GSTIN/i.test(line) || /GST NO/i.test(line)) {
//         // The line above or two above usually has the business name
//         const idx = lines.indexOf(line);
//         const nameLine = lines[idx - 2] || lines[idx - 1] || lines[0];
//         if (nameLine && nameLine.length < 50) {
//           return nameLine.trim();
//         }
//       }
//     }

//     // Common patterns
//     const merchantPatterns = [
//       /^([A-Z][A-Za-z\s&\.'-]{3,40})$/,
//       /^([A-Z\s]{3,})$/,
//       /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/,
//     ];

//     for (const line of nonEmptyLines.slice(0, 5)) {
//       for (const pattern of merchantPatterns) {
//         const match = line.match(pattern);
//         if (match) {
//           const name = match[1].trim();
//           // Filter out noise
//           if (name.length > 3 && !/^(TOTAL|DATE|BILL|INVOICE|CASH|CARD|TAX|GST)/i.test(name)) {
//             return name;
//           }
//         }
//       }
//     }

//     return nonEmptyLines[0]?.trim().substring(0, 50) || 'Unknown Merchant';
//   }

//   private extractDate(lines: string[]): Date | undefined {
//     const datePatterns = [
//       // DD/MM/YYYY or DD-MM-YYYY (Indian format)
//       /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{4})/,
//       // YYYY-MM-DD
//       /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
//       // Date: prefix
//       /Date\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
//       // Bill Date
//       /Bill\s*Date\s*[:\-]\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
//     ];

//     for (const line of lines) {
//       for (const pattern of datePatterns) {
//         const match = line.match(pattern);
//         if (match) {
//           const dateStr = match[1];
//           // Try Indian format first (DD/MM/YYYY)
//           const parts = dateStr.split(/[\/\-\.]/);
//           let date: Date;
          
//           if (parts[0].length === 4) {
//             // YYYY-MM-DD
//             date = new Date(dateStr);
//           } else if (parseInt(parts[0]) > 12) {
//             // DD-MM-YYYY (day > 12)
//             date = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
//           } else {
//             // Assume DD/MM/YYYY for Indian receipts
//             date = new Date(`${parts[1]}/${parts[0]}/${parts[2]}`);
//           }

//           if (!isNaN(date.getTime()) && date.getFullYear() > 2020 && date.getFullYear() < 2030) {
//             return date;
//           }
//         }
//       }
//     }

//     return undefined;
//   }

//   private extractTotalAmount(lines: string[]): number {
//     const totalPatterns = [
//       // Grand Total / Total with various prefixes
//       /Grand\s*Total\s*[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//       /Total\s*[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//       /Amount\s*(?:Due|Payable)?\s*[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//       /Bill\s*Amount\s*[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//       /Net\s*Amount\s*[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//       // Just the amount at the end of a line
//       /[₹$€£]\s*(\d+[\.\,]\d{2})\s*$/,
//       /(\d+[\.\,]\d{2})\s*$/,
//     ];

//     // Check from bottom of receipt (totals usually at bottom)
//     const reversedLines = [...lines].reverse();
    
//     for (const line of reversedLines) {
//       for (const pattern of totalPatterns) {
//         const match = line.match(pattern);
//         if (match) {
//           const amount = parseFloat(match[1].replace(/,/g, ''));
//           // Validate: realistic receipt amounts
//           if (amount > 0 && amount < 1000000) {
//             return amount;
//           }
//         }
//       }
//     }

//     // Fallback: find the largest number that looks like a total
//     const amounts = lines
//       .map(line => {
//         const match = line.match(/[₹$€£]?\s*(\d{2,}[\.\,]\d{2})/);
//         return match ? parseFloat(match[1].replace(/,/g, '')) : 0;
//       })
//       .filter(a => a > 0 && a < 1000000)
//       .sort((a, b) => b - a);

//     return amounts[0] || 0;
//   }

//   private extractTaxAmount(lines: string[]): number {
//     const taxPatterns = [
//       /CGST\s*(?:@?\s*\d+%?\s*)?[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//       /SGST\s*(?:@?\s*\d+%?\s*)?[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//       /IGST\s*(?:@?\s*\d+%?\s*)?[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//       /GST\s*(?:@?\s*\d+%?\s*)?[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//       /TAX\s*(?:@?\s*\d+%?\s*)?[:\=]?\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/i,
//     ];

//     let totalTax = 0;

//     for (const line of lines) {
//       for (const pattern of taxPatterns) {
//         const match = line.match(pattern);
//         if (match) {
//           totalTax += parseFloat(match[1].replace(/,/g, ''));
//         }
//       }
//     }

//     return totalTax;
//   }

//   private extractCurrency(lines: string[]): string {
//     const allText = lines.join(' ');
    
//     if (allText.includes('₹') || allText.includes('Rs.') || allText.includes('INR')) return 'INR';
//     if (allText.includes('$') || allText.includes('USD')) return 'USD';
//     if (allText.includes('€') || allText.includes('EUR')) return 'EUR';
//     if (allText.includes('£') || allText.includes('GBP')) return 'GBP';
//     if (allText.includes('¥') || allText.includes('JPY')) return 'JPY';
    
//     return 'INR'; // Default for Indian users
//   }

//   private extractLineItems(lines: string[]): Array<{
//     name: string;
//     category: string;
//     price: number;
//     quantity: number;
//     confidence: number;
//   }> {
//     const items: Array<{
//       name: string;
//       category: string;
//       price: number;
//       quantity: number;
//       confidence: number;
//     }> = [];

//     // Match patterns like:
//     // "Item Name          2 x 150.00 = 300.00"
//     // "Item Name          150.00"
//     const itemPatterns = [
//       /^(.+?)\s+(\d+)\s*x\s*[₹$€£]?\s*(\d+[\.\,]\d{2})\s*=\s*[₹$€£]?\s*(\d+[\.\,]\d{2})/,
//       /^(.+?)\s+(\d+)\s+[₹$€£]?\s*(\d+[\.\,]\d{2})/,
//       /^(.+?)\s+[₹$€£]?\s*(\d+[\.\,]\d{2})$/,
//     ];

//     for (const line of lines) {
//       // Skip non-item lines
//       if (
//         /total|grand|subtotal|tax|gst|cgst|sgst|igst|discount|round|change|tender|cash|card|upi|thank|visit|bill|invoice/i.test(line)
//       ) {
//         continue;
//       }

//       for (const pattern of itemPatterns) {
//         const match = line.match(pattern);
//         if (match) {
//           const name = match[1].trim();
//           // Filter out garbage
//           if (name.length < 2 || /^\d+$/.test(name)) continue;

//           items.push({
//             name: name.substring(0, 100),
//             category: 'other',
//             price: parseFloat((match[3] || match[2]).replace(/,/g, '')),
//             quantity: match[2] && !isNaN(parseInt(match[2])) ? parseInt(match[2]) : 1,
//             confidence: 0.6,
//           });
//           break;
//         }
//       }
//     }

//     return items;
//   }

//   // ============================================================
//   // CATEGORIZATION
//   // ============================================================

//   private categorizeItems(items: Array<{
//     name: string;
//     category: string;
//     price: number;
//     quantity: number;
//     confidence: number;
//   }>): Array<{
//     name: string;
//     category: string;
//     price: number;
//     quantity: number;
//     confidence: number;
//   }> {
//     const CATEGORY_KEYWORDS: Record<string, string[]> = {
//       'food': [
//         'pizza', 'burger', 'sandwich', 'salad', 'pasta', 'rice', 'biryani',
//         'curry', 'dal', 'roti', 'naan', 'paneer', 'chicken', 'mutton', 'fish',
//         'dosa', 'idli', 'vada', 'samosa', 'chai', 'coffee', 'tea', 'drink',
//         'juice', 'water', 'soda', 'beer', 'wine', 'cocktail', 'dessert',
//         'ice cream', 'cake', 'sweet', 'snack', 'breakfast', 'lunch', 'dinner',
//         'meal', 'combo', 'thali', 'starter', 'appetizer', 'main course',
//       ],
//       'transport': [
//         'uber', 'ola', 'rapido', 'taxi', 'cab', 'auto', 'rickshaw',
//         'bus', 'train', 'metro', 'flight', 'fuel', 'petrol', 'diesel',
//         'parking', 'toll', 'cnpg', 'fastag',
//       ],
//       'stay': [
//         'hotel', 'room', 'resort', 'hostel', 'airbnb', 'lodge', 'inn',
//         'suite', 'accommodation', 'check-in', 'check-out', 'night stay',
//       ],
//       'shopping': [
//         'shirt', 'pant', 'dress', 'shoe', 'bag', 'watch', 'jewelry',
//         'phone', 'laptop', 'charger', 'cable', 'book', 'pen', 'notebook',
//         'grocery', 'vegetable', 'fruit', 'milk', 'bread', 'egg',
//       ],
//       'health': [
//         'medicine', 'tablet', 'capsule', 'syrup', 'doctor', 'hospital',
//         'clinic', 'pharmacy', 'test', 'scan', 'x-ray', 'consultation',
//       ],
//       'activity': [
//         'movie', 'ticket', 'show', 'concert', 'museum', 'zoo', 'park',
//         'game', 'sport', 'gym', 'pool', 'spa', 'massage', 'tour',
//       ],
//     };

//     return items.map(item => {
//       const nameLower = item.name.toLowerCase();
      
//       for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
//         if (keywords.some(kw => nameLower.includes(kw))) {
//           return { ...item, category, confidence: Math.max(item.confidence, 0.8) };
//         }
//       }

//       return item;
//     });
//   }

//   private categorizeIndianMerchant(merchantName: string, lines: string[]): string | null {
//     const allText = [merchantName, ...lines].join(' ').toLowerCase();

//     const MERCHANT_CATEGORIES: Record<string, string[]> = {
//       'food': [
//         'restaurant', 'cafe', 'hotel', 'dhaba', 'canteen', 'biryani',
//         'swiggy', 'zomato', 'mcdonalds', 'kfc', 'dominos', 'pizza hut',
//         'starbucks', 'chaayos', 'chai point', 'haldiram', 'bikaner',
//         'barbeque', 'grill', 'dine', 'diner', 'bakery', 'sweets',
//         'food court', 'food plaza', 'refreshments',
//       ],
//       'transport': [
//         'uber', 'ola', 'rapido', 'irctc', 'railway', 'metro', 'bus',
//         'indian oil', 'bharat petroleum', 'hp petrol', 'fuel station',
//         'toll plaza', 'parking', 'airlines', 'airport', 'indigo',
//         'spicejet', 'vistara', 'air india',
//       ],
//       'shopping': [
//         'mart', 'store', 'bazaar', 'mall', 'amazon', 'flipkart',
//         'myntra', 'ajio', 'bigbasket', 'dmart', 'd-mart', 'reliance',
//         'hypermarket', 'supermarket', 'wholesale', 'retail',
//         'croma', 'vijay sales', 'lifestyle', 'shoppers stop',
//       ],
//       'health': [
//         'hospital', 'clinic', 'pharmacy', 'medical', 'diagnostic',
//         'apollo', 'fortis', 'max healthcare', 'medanta', 'aiims',
//         'pathology', 'lab', 'medplus', 'pharmeasy', 'netmeds',
//       ],
//       'activity': [
//         'cinema', 'pvr', 'inox', 'bookmyshow', 'museum', 'zoo',
//         'park', 'ticket', 'entry', 'show', 'concert', 'stadium',
//         'club', 'lounge', 'pub', 'bar',
//       ],
//     };

//     for (const [category, keywords] of Object.entries(MERCHANT_CATEGORIES)) {
//       if (keywords.some(kw => allText.includes(kw))) {
//         return category;
//       }
//     }

//     return null;
//   }

//   // ============================================================
//   // FINALIZE
//   // ============================================================

//   private async finalizeReceipt(
//     receipt: any,
//     ocrResult: OCRResult,
//     updateStatus: boolean,
//     startTime: number
//   ): Promise<void> {
//     receipt.ocrData = {
//       processed: true,
//       confidence: ocrResult.confidence,
//       rawText: ocrResult.rawText,
//       extractedItems: ocrResult.extractedItems || [],
//       merchantName: ocrResult.merchantName,
//       merchantAddress: ocrResult.merchantAddress,
//       date: ocrResult.date,
//       totalAmount: ocrResult.totalAmount,
//       taxAmount: ocrResult.taxAmount,
//       currency: ocrResult.currency,
//       paymentMethod: ocrResult.paymentMethod,
//       error: ocrResult.error,
//       provider: ocrResult.provider,
//     } as any;

//     if (updateStatus) {
//       receipt.status = ocrResult.success ? 'COMPLETED' : 'FAILED';
//       receipt.statusHistory.push({
//         status: receipt.status,
//         timestamp: new Date(),
//         message: ocrResult.success
//           ? `OCR completed via ${ocrResult.provider || 'unknown'} in ${Date.now() - startTime}ms`
//           : `OCR failed: ${ocrResult.error}`,
//       });
//     }

//     receipt.markModified('ocrData');
//     await receipt.save();
//   }
// }

// export const ocrProcessor = new OCRProcessor();





// // import { logger } from '../../config/logger';
// // import { config } from '../../config';
// // import sharp from 'sharp';
// // import path from 'path';
// // import fs from 'fs/promises';
// // import { Receipt } from './receipt.model';
// // import { Types } from 'mongoose';

// // interface OCRResult {
// //   success: boolean;
// //   confidence: number;
// //   rawText?: string;
// //   extractedItems?: Array<{
// //     name: string;
// //     category: string;
// //     price: number;
// //     quantity: number;
// //     confidence: number;
// //   }>;
// //   merchantName?: string;
// //   merchantAddress?: string;
// //   date?: Date;
// //   totalAmount?: number;
// //   taxAmount?: number;
// //   currency?: string;
// //   paymentMethod?: string;
// //   error?: string;
// // }

// // export class OCRProcessor {
// //   /**
// //    * Process receipt image with AI OCR
// //    */
// //   async processReceipt(receiptId: string, imagePath: string): Promise<OCRResult> {
// //     try {
// //       const receipt = await Receipt.findOne({ receiptId });
// //       if (!receipt) {
// //         throw new Error('Receipt not found');
// //       }

// //       // Update status to processing
// //       receipt.status = 'PROCESSING';
// //       receipt.statusHistory.push({
// //         status: 'PROCESSING',
// //         timestamp: new Date(),
// //         message: 'OCR processing started'
// //       });
// //       await receipt.save();

// //       // Step 1: Preprocess image for better OCR
// //       const processedImagePath = await this.preprocessImage(imagePath);

// //       // Step 2: Perform OCR based on configured provider
// //       let ocrResult: OCRResult;

// //       if (config.OCR_SERVICE_PROVIDER === 'google_vision') {
// //         ocrResult = await this.processWithGoogleVision(processedImagePath);
// //       } else if (config.OCR_SERVICE_PROVIDER === 'aws_textract') {
// //         ocrResult = await this.processWithAWSTextract(processedImagePath);
// //       } else {
// //         ocrResult = await this.processWithTesseract(processedImagePath);
// //       }

// //       // Step 3: Post-process OCR results
// //       if (ocrResult.success) {
// //         ocrResult = await this.postProcessResults(ocrResult);
// //       }

// //       // Step 4: Update receipt with OCR data
// //       receipt.ocrData = {
// //         processed: true,
// //         confidence: ocrResult.confidence,
// //         rawText: ocrResult.rawText,
// //         extractedItems: ocrResult.extractedItems || [],
// //         merchantName: ocrResult.merchantName,
// //         merchantAddress: ocrResult.merchantAddress,
// //         date: ocrResult.date,
// //         totalAmount: ocrResult.totalAmount,
// //         taxAmount: ocrResult.taxAmount,
// //         currency: ocrResult.currency,
// //         paymentMethod: ocrResult.paymentMethod,
// //         error: ocrResult.error
// //       } as any;

// //       receipt.status = ocrResult.success ? 'COMPLETED' : 'FAILED';
// //       receipt.statusHistory.push({
// //         status: receipt.status,
// //         timestamp: new Date(),
// //         message: ocrResult.success ? 'OCR processing completed' : `OCR failed: ${ocrResult.error}`
// //       });

// //       await receipt.save();

// //       // Clean up processed image
// //       await fs.unlink(processedImagePath).catch(() => {});

// //       return ocrResult;
// //     } catch (error) {
// //       const err = error as Error;
// //       logger.error('OCR processing failed:', err);
      
// //       // Update receipt with error
// //       await Receipt.findOneAndUpdate(
// //         { receiptId },
// //         {
// //           $set: {
// //             status: 'FAILED',
// //             'ocrData.processed': true,
// //             'ocrData.error': err.message
// //           },
// //           $push: {
// //             statusHistory: {
// //               status: 'FAILED',
// //               timestamp: new Date(),
// //               message: `OCR failed: ${err.message}`
// //             }
// //           }
// //         }
// //       );

// //       return {
// //         success: false,
// //         confidence: 0,
// //         error: err.message
// //       };
// //     }
// //   }

// //   /**
// //    * Preprocess image for better OCR accuracy
// //    */
// //   private async preprocessImage(imagePath: string): Promise<string> {
// //     const outputPath = imagePath.replace(/\.[^.]+$/, '_processed.png');

// //     await sharp(imagePath)
// //       .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
// //       .grayscale()
// //       .normalize()
// //       .sharpen()
// //       .threshold(128)
// //       .toFile(outputPath);

// //     return outputPath;
// //   }

// //   /**
// //    * Process with Google Vision API
// //    */
// //   private async processWithGoogleVision(imagePath: string): Promise<OCRResult> {
// //     try {
// //       // Simulated Google Vision API call
// //       // In production, use @google-cloud/vision package
// //       logger.info('Processing with Google Vision API');
      
// //       const imageBuffer = await fs.readFile(imagePath);
      
// //       // This is where you'd make the actual API call
// //       // const [result] = await visionClient.textDetection(imageBuffer);
// //       // const annotations = result.textAnnotations;
      
// //       // Simulated result
// //       return {
// //         success: true,
// //         confidence: 0.92,
// //         rawText: 'SIMULATED OCR TEXT - Replace with actual API call',
// //         extractedItems: [],
// //         merchantName: 'Sample Merchant',
// //         totalAmount: 0,
// //         taxAmount: 0
// //       };
// //     } catch (error) {
// //       const err = error as Error;
// //       logger.error('Google Vision OCR failed:', err);
// //       return {
// //         success: false,
// //         confidence: 0,
// //         error: err.message
// //       };
// //     }
// //   }

// //   /**
// //    * Process with AWS Textract
// //    */
// //   private async processWithAWSTextract(imagePath: string): Promise<OCRResult> {
// //     try {
// //       logger.info('Processing with AWS Textract');
      
// //       const imageBuffer = await fs.readFile(imagePath);
      
// //       // AWS Textract API call would go here
      
// //       return {
// //         success: true,
// //         confidence: 0.88,
// //         rawText: 'SIMULATED OCR TEXT - Replace with actual API call',
// //         extractedItems: [],
// //         merchantName: 'Sample Merchant',
// //         totalAmount: 0,
// //         taxAmount: 0
// //       };
// //     } catch (error) {
// //       const err = error as Error;
// //       logger.error('AWS Textract OCR failed:', err);
// //       return {
// //         success: false,
// //         confidence: 0,
// //         error: err.message
// //       };
// //     }
// //   }

// //   /**
// //    * Process with Tesseract.js — Real OCR implementation
// //    * Supports English + Devanagari (Hindi) for Indian receipts
// //    */
// //   private async processWithTesseract(imagePath: string): Promise<OCRResult> {
// //     try {
// //       logger.info('Processing with Tesseract OCR (real)');

// //       // Dynamic import to avoid startup cost
// //       const { createWorker } = await import('tesseract.js');

// //       const worker = await createWorker(['eng'], 1, {
// //         logger: (m: any) => {
// //           if (m.status === 'recognizing text') {
// //             logger.debug(`OCR progress: ${Math.round(m.progress * 100)}%`);
// //           }
// //         },
// //       });

// //       // Optimize for receipt text — PSM 6 = uniform block of text
// //       await worker.setParameters({
// //         tessedit_pageseg_mode: '6' as any,
// //         preserve_interword_spaces: '1',
// //       });

// //       const { data } = await worker.recognize(imagePath);
// //       await worker.terminate();

// //       const rawText = data.text;
// //       const confidence = data.confidence / 100;

// //       logger.info(`Tesseract OCR complete. Confidence: ${(confidence * 100).toFixed(1)}%`);

// //       return {
// //         success: true,
// //         confidence,
// //         rawText,
// //         extractedItems: [],
// //         merchantName: undefined,
// //         totalAmount: 0,
// //         taxAmount: 0,
// //       };
// //     } catch (error) {
// //       const err = error as Error;
// //       logger.error('Tesseract OCR failed:', err);
// //       return {
// //         success: false,
// //         confidence: 0,
// //         error: err.message,
// //       };
// //     }
// //   }

// //   /**
// //    * Post-process OCR results with AI/ML
// //    */
// //   private async postProcessResults(ocrResult: OCRResult): Promise<OCRResult> {
// //     if (!ocrResult.rawText) return ocrResult;

// //     const lines = ocrResult.rawText.split('\n').filter(line => line.trim());

// //     // Extract merchant name (usually first line or largest text)
// //     ocrResult.merchantName = this.extractMerchantName(lines);

// //     // Extract date
// //     ocrResult.date = this.extractDate(lines);

// //     // Extract total amount
// //     ocrResult.totalAmount = this.extractTotalAmount(lines);

// //     // Extract tax amount
// //     ocrResult.taxAmount = this.extractTaxAmount(lines);

// //     // Extract line items
// //     ocrResult.extractedItems = this.extractLineItems(lines);

// //     // Extract currency
// //     ocrResult.currency = this.extractCurrency(lines);

// //     // Categorize items using ML/semantic analysis
// //     ocrResult.extractedItems = this.categorizeItems(ocrResult.extractedItems);

// //     // Indian-specific: detect merchant type from name + keywords
// //     const merchantCategory = this.categorizeIndianMerchant(ocrResult.merchantName || '', lines);
// //     if (merchantCategory && ocrResult.extractedItems.length === 0) {
// //       // Add the whole bill as a single line item with the detected category
// //       ocrResult.extractedItems = [{
// //         name: ocrResult.merchantName || 'Purchase',
// //         category: merchantCategory,
// //         price: ocrResult.totalAmount || 0,
// //         quantity: 1,
// //         confidence: 0.7,
// //       }];
// //     }

// //     return ocrResult;
// //   }

// //   /**
// //    * Auto-categorize Indian merchant based on name + receipt keywords
// //    */
// //   private categorizeIndianMerchant(merchantName: string, lines: string[]): string | null {
// //     const allText = [merchantName, ...lines].join(' ').toLowerCase();
// //     const MERCHANT_CATEGORIES: Record<string, string[]> = {
// //       'food': ['restaurant', 'cafe', 'hotel', 'dhaba', 'canteen', 'biryani', 'swiggy', 'zomato', 'mcdonalds', 'kfc', 'dominos', 'pizza', 'chai', 'dine'],
// //       'transport': ['uber', 'ola', 'rapido', 'taxi', 'cab', 'auto', 'rickshaw', 'bus', 'irctc', 'railway', 'metro', 'fuel', 'petrol', 'diesel', 'toll', 'parking'],
// //       'stay': ['lodge', 'inn', 'resort', 'guest house', 'oyo', 'makemytrip', 'airbnb', 'rooms'],
// //       'shopping': ['mart', 'store', 'bazaar', 'mall', 'amazon', 'flipkart', 'myntra', 'ajio', 'bigbasket', 'd-mart', 'hypermarket'],
// //       'health': ['hospital', 'clinic', 'pharmacy', 'medical', 'diagnostic', 'apollo', 'fortis', 'medplus'],
// //       'activity': ['museum', 'zoo', 'park', 'ticket', 'entry', 'show', 'cinema', 'pvr', 'inox', 'bookmyshow'],
// //     };
// //     for (const [category, keywords] of Object.entries(MERCHANT_CATEGORIES)) {
// //       if (keywords.some(kw => allText.includes(kw))) return category;
// //     }
// //     return null;
// //   }



// //   /**
// //    * Extract merchant name from OCR text
// //    */
// //   private extractMerchantName(lines: string[]): string {
// //     // Usually the first non-empty line or the line with largest font
// //     const merchantPatterns = [
// //       /^([A-Z\s]{3,})$/,
// //       /^([A-Z][a-z]+\s)+(Restaurant|Hotel|Cafe|Store|Shop|Mart)/i,
// //     ];

// //     for (const line of lines) {
// //       for (const pattern of merchantPatterns) {
// //         const match = line.match(pattern);
// //         if (match) return match[1].trim();
// //       }
// //     }

// //     return lines[0]?.trim() || 'Unknown Merchant';
// //   }

// //   /**
// //    * Extract date from OCR text
// //    */
// //   private extractDate(lines: string[]): Date | undefined {
// //     const datePatterns = [
// //       /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
// //       /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
// //       /Date:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
// //     ];

// //     for (const line of lines) {
// //       for (const pattern of datePatterns) {
// //         const match = line.match(pattern);
// //         if (match) {
// //           const date = new Date(match[1]);
// //           if (!isNaN(date.getTime())) return date;
// //         }
// //       }
// //     }

// //     return undefined;
// //   }

// //   /**
// //    * Extract total amount from OCR text
// //    */
// //   private extractTotalAmount(lines: string[]): number {
// //     const totalPatterns = [
// //       /Total\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //       /Grand\s*Total\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //       /Amount\s*Due\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //       /[$€£₹]\s*(\d+[\.\,]\d{2})\s*$/,
// //     ];

// //     for (const line of lines.reverse()) { // Check from bottom
// //       for (const pattern of totalPatterns) {
// //         const match = line.match(pattern);
// //         if (match) {
// //           return parseFloat(match[1].replace(',', ''));
// //         }
// //       }
// //     }

// //     return 0;
// //   }

// //   /**
// //    * Extract tax amount — supports Indian GST (CGST, SGST, IGST)
// //    */
// //   private extractTaxAmount(lines: string[]): number {
// //     const taxPatterns = [
// //       /CGST\s*[:=@]?\s*\d*\.?\d*%?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //       /SGST\s*[:=@]?\s*\d*\.?\d*%?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //       /IGST\s*[:=@]?\s*\d*\.?\d*%?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //       /GST\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //       /TAX\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //       /VAT\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //       /Service\s*Tax\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
// //     ];

// //     let totalTax = 0;
// //     const taxFound = new Set<string>();

// //     for (const line of lines) {
// //       for (const pattern of taxPatterns) {
// //         const match = line.match(pattern);
// //         if (match) {
// //           const key = pattern.source.substring(0, 6);
// //           if (!taxFound.has(key)) {
// //             totalTax += parseFloat(match[1].replace(',', ''));
// //             taxFound.add(key);
// //           }
// //         }
// //       }
// //     }

// //     return totalTax;
// //   }

// //   /**
// //    * Extract line items from receipt
// //    */
// //   private extractLineItems(lines: string[]): Array<{
// //     name: string;
// //     category: string;
// //     price: number;
// //     quantity: number;
// //     confidence: number;
// //   }> {
// //     const items: Array<{
// //       name: string;
// //       category: string;
// //       price: number;
// //       quantity: number;
// //       confidence: number;
// //     }> = [];

// //     const itemPattern = /^(.+?)\s+(\d+)\s+[$€£₹]?\s*(\d+[\.\,]\d{2})$/;

// //     for (const line of lines) {
// //       const match = line.match(itemPattern);
// //       if (match) {
// //         items.push({
// //           name: match[1].trim(),
// //           category: 'Other', // Will be categorized later
// //           price: parseFloat(match[3].replace(',', '')),
// //           quantity: parseInt(match[2]),
// //           confidence: 0.8
// //         });
// //       }
// //     }

// //     return items;
// //   }

// //   /**
// //    * Extract currency from receipt
// //    */
// //   private extractCurrency(lines: string[]): string {
// //     const currencySymbols: Record<string, string> = {
// //       '₹': 'INR',
// //       '$': 'USD',
// //       '€': 'EUR',
// //       '£': 'GBP',
// //       '¥': 'JPY',
// //     };

// //     for (const line of lines) {
// //       for (const [symbol, code] of Object.entries(currencySymbols)) {
// //         if (line.includes(symbol)) return code;
// //       }
// //     }

// //     return 'INR'; // Default
// //   }

// //   /**
// //    * Categorize items using semantic analysis
// //    */
// //   private categorizeItems(items: Array<{
// //     name: string;
// //     category: string;
// //     price: number;
// //     quantity: number;
// //     confidence: number;
// //   }>): Array<{
// //     name: string;
// //     category: string;
// //     price: number;
// //     quantity: number;
// //     confidence: number;
// //   }> {
// //     const categoryKeywords: Record<string, string[]> = {
// //       'Food & Dining': ['burger', 'pizza', 'salad', 'steak', 'pasta', 'rice', 'curry', 'sushi', 'sandwich', 'coffee', 'tea', 'drink', 'wine', 'beer', 'dessert', 'appetizer', 'main course'],
// //       'Transportation': ['uber', 'ola', 'taxi', 'bus', 'train', 'metro', 'fuel', 'gas', 'parking', 'toll', 'flight', 'airline'],
// //       'Accommodation': ['hotel', 'room', 'resort', 'hostel', 'airbnb', 'rent', 'stay'],
// //       'Entertainment': ['movie', 'game', 'ticket', 'show', 'concert', 'sport', 'park', 'museum', 'zoo'],
// //       'Shopping': ['shirt', 'pant', 'dress', 'shoe', 'bag', 'watch', 'jewelry', 'electronic', 'phone', 'laptop'],
// //       'Groceries': ['milk', 'bread', 'egg', 'vegetable', 'fruit', 'rice', 'flour', 'sugar', 'oil', 'spice'],
// //       'Healthcare': ['medicine', 'doctor', 'hospital', 'pharmacy', 'clinic', 'vitamin', 'supplement'],
// //       'Utilities': ['electricity', 'water', 'gas', 'internet', 'phone', 'bill', 'recharge'],
// //     };

// //     return items.map(item => {
// //       const itemNameLower = item.name.toLowerCase();
      
// //       for (const [category, keywords] of Object.entries(categoryKeywords)) {
// //         if (keywords.some(keyword => itemNameLower.includes(keyword))) {
// //           return { ...item, category };
// //         }
// //       }

// //       return item; // Keep as 'Other' if no match
// //     });
// //   }
// // }

// // export const ocrProcessor = new OCRProcessor();