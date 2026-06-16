import { logger } from '../../config/logger';
import { config } from '../../config';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { Receipt } from './receipt.model';
import { Types } from 'mongoose';

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
}

export class OCRProcessor {
  /**
   * Process receipt image with AI OCR
   */
  async processReceipt(receiptId: string, imagePath: string): Promise<OCRResult> {
    try {
      const receipt = await Receipt.findOne({ receiptId });
      if (!receipt) {
        throw new Error('Receipt not found');
      }

      // Update status to processing
      receipt.status = 'PROCESSING';
      receipt.statusHistory.push({
        status: 'PROCESSING',
        timestamp: new Date(),
        message: 'OCR processing started'
      });
      await receipt.save();

      // Step 1: Preprocess image for better OCR
      const processedImagePath = await this.preprocessImage(imagePath);

      // Step 2: Perform OCR based on configured provider
      let ocrResult: OCRResult;

      if (config.OCR_SERVICE_PROVIDER === 'google_vision') {
        ocrResult = await this.processWithGoogleVision(processedImagePath);
      } else if (config.OCR_SERVICE_PROVIDER === 'aws_textract') {
        ocrResult = await this.processWithAWSTextract(processedImagePath);
      } else {
        ocrResult = await this.processWithTesseract(processedImagePath);
      }

      // Step 3: Post-process OCR results
      if (ocrResult.success) {
        ocrResult = await this.postProcessResults(ocrResult);
      }

      // Step 4: Update receipt with OCR data
      receipt.ocrData = {
        processed: true,
        confidence: ocrResult.confidence,
        rawText: ocrResult.rawText,
        extractedItems: ocrResult.extractedItems,
        merchantName: ocrResult.merchantName,
        merchantAddress: ocrResult.merchantAddress,
        date: ocrResult.date,
        totalAmount: ocrResult.totalAmount,
        taxAmount: ocrResult.taxAmount,
        currency: ocrResult.currency,
        paymentMethod: ocrResult.paymentMethod,
        error: ocrResult.error
      };

      receipt.status = ocrResult.success ? 'COMPLETED' : 'FAILED';
      receipt.statusHistory.push({
        status: receipt.status,
        timestamp: new Date(),
        message: ocrResult.success ? 'OCR processing completed' : `OCR failed: ${ocrResult.error}`
      });

      await receipt.save();

      // Clean up processed image
      await fs.unlink(processedImagePath).catch(() => {});

      return ocrResult;
    } catch (error) {
      const err = error as Error;
      logger.error('OCR processing failed:', err);
      
      // Update receipt with error
      await Receipt.findOneAndUpdate(
        { receiptId },
        {
          $set: {
            status: 'FAILED',
            'ocrData.processed': true,
            'ocrData.error': err.message
          },
          $push: {
            statusHistory: {
              status: 'FAILED',
              timestamp: new Date(),
              message: `OCR failed: ${err.message}`
            }
          }
        }
      );

      return {
        success: false,
        confidence: 0,
        error: err.message
      };
    }
  }

  /**
   * Preprocess image for better OCR accuracy
   */
  private async preprocessImage(imagePath: string): Promise<string> {
    const outputPath = imagePath.replace(/\.[^.]+$/, '_processed.png');

    await sharp(imagePath)
      .resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .normalize()
      .sharpen()
      .threshold(128)
      .toFile(outputPath);

    return outputPath;
  }

  /**
   * Process with Google Vision API
   */
  private async processWithGoogleVision(imagePath: string): Promise<OCRResult> {
    try {
      // Simulated Google Vision API call
      // In production, use @google-cloud/vision package
      logger.info('Processing with Google Vision API');
      
      const imageBuffer = await fs.readFile(imagePath);
      
      // This is where you'd make the actual API call
      // const [result] = await visionClient.textDetection(imageBuffer);
      // const annotations = result.textAnnotations;
      
      // Simulated result
      return {
        success: true,
        confidence: 0.92,
        rawText: 'SIMULATED OCR TEXT - Replace with actual API call',
        extractedItems: [],
        merchantName: 'Sample Merchant',
        totalAmount: 0,
        taxAmount: 0
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Google Vision OCR failed:', err);
      return {
        success: false,
        confidence: 0,
        error: err.message
      };
    }
  }

  /**
   * Process with AWS Textract
   */
  private async processWithAWSTextract(imagePath: string): Promise<OCRResult> {
    try {
      logger.info('Processing with AWS Textract');
      
      const imageBuffer = await fs.readFile(imagePath);
      
      // AWS Textract API call would go here
      
      return {
        success: true,
        confidence: 0.88,
        rawText: 'SIMULATED OCR TEXT - Replace with actual API call',
        extractedItems: [],
        merchantName: 'Sample Merchant',
        totalAmount: 0,
        taxAmount: 0
      };
    } catch (error) {
      const err = error as Error;
      logger.error('AWS Textract OCR failed:', err);
      return {
        success: false,
        confidence: 0,
        error: err.message
      };
    }
  }

  /**
   * Process with Tesseract.js (fallback)
   */
  private async processWithTesseract(imagePath: string): Promise<OCRResult> {
    try {
      logger.info('Processing with Tesseract OCR');
      
      // Tesseract.js processing
      // const worker = await createWorker();
      // const { data: { text, confidence } } = await worker.recognize(imagePath);
      
      return {
        success: true,
        confidence: 0.75,
        rawText: 'SIMULATED OCR TEXT - Replace with actual Tesseract processing',
        extractedItems: [],
        merchantName: 'Sample Merchant',
        totalAmount: 0,
        taxAmount: 0
      };
    } catch (error) {
      const err = error as Error;
      logger.error('Tesseract OCR failed:', err);
      return {
        success: false,
        confidence: 0,
        error: err.message
      };
    }
  }

  /**
   * Post-process OCR results with AI/ML
   */
  private async postProcessResults(ocrResult: OCRResult): Promise<OCRResult> {
    if (!ocrResult.rawText) return ocrResult;

    const lines = ocrResult.rawText.split('\n').filter(line => line.trim());

    // Extract merchant name (usually first line or largest text)
    ocrResult.merchantName = this.extractMerchantName(lines);

    // Extract date
    ocrResult.date = this.extractDate(lines);

    // Extract total amount
    ocrResult.totalAmount = this.extractTotalAmount(lines);

    // Extract tax amount
    ocrResult.taxAmount = this.extractTaxAmount(lines);

    // Extract line items
    ocrResult.extractedItems = this.extractLineItems(lines);

    // Extract currency
    ocrResult.currency = this.extractCurrency(lines);

    // Categorize items using ML/semantic analysis
    ocrResult.extractedItems = this.categorizeItems(ocrResult.extractedItems);

    return ocrResult;
  }

  /**
   * Extract merchant name from OCR text
   */
  private extractMerchantName(lines: string[]): string {
    // Usually the first non-empty line or the line with largest font
    const merchantPatterns = [
      /^([A-Z\s]{3,})$/,
      /^([A-Z][a-z]+\s)+(Restaurant|Hotel|Cafe|Store|Shop|Mart)/i,
    ];

    for (const line of lines) {
      for (const pattern of merchantPatterns) {
        const match = line.match(pattern);
        if (match) return match[1].trim();
      }
    }

    return lines[0]?.trim() || 'Unknown Merchant';
  }

  /**
   * Extract date from OCR text
   */
  private extractDate(lines: string[]): Date | undefined {
    const datePatterns = [
      /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
      /(\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
      /Date:\s*(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/i,
    ];

    for (const line of lines) {
      for (const pattern of datePatterns) {
        const match = line.match(pattern);
        if (match) {
          const date = new Date(match[1]);
          if (!isNaN(date.getTime())) return date;
        }
      }
    }

    return undefined;
  }

  /**
   * Extract total amount from OCR text
   */
  private extractTotalAmount(lines: string[]): number {
    const totalPatterns = [
      /Total\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
      /Grand\s*Total\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
      /Amount\s*Due\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
      /[$€£₹]\s*(\d+[\.\,]\d{2})\s*$/,
    ];

    for (const line of lines.reverse()) { // Check from bottom
      for (const pattern of totalPatterns) {
        const match = line.match(pattern);
        if (match) {
          return parseFloat(match[1].replace(',', ''));
        }
      }
    }

    return 0;
  }

  /**
   * Extract tax amount
   */
  private extractTaxAmount(lines: string[]): number {
    const taxPatterns = [
      /TAX\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
      /GST\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
      /VAT\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
      /Service\s*Tax\s*[:=]?\s*[$€£₹]?\s*(\d+[\.\,]\d{2})/i,
    ];

    for (const line of lines) {
      for (const pattern of taxPatterns) {
        const match = line.match(pattern);
        if (match) {
          return parseFloat(match[1].replace(',', ''));
        }
      }
    }

    return 0;
  }

  /**
   * Extract line items from receipt
   */
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

    const itemPattern = /^(.+?)\s+(\d+)\s+[$€£₹]?\s*(\d+[\.\,]\d{2})$/;

    for (const line of lines) {
      const match = line.match(itemPattern);
      if (match) {
        items.push({
          name: match[1].trim(),
          category: 'Other', // Will be categorized later
          price: parseFloat(match[3].replace(',', '')),
          quantity: parseInt(match[2]),
          confidence: 0.8
        });
      }
    }

    return items;
  }

  /**
   * Extract currency from receipt
   */
  private extractCurrency(lines: string[]): string {
    const currencySymbols: Record<string, string> = {
      '₹': 'INR',
      '$': 'USD',
      '€': 'EUR',
      '£': 'GBP',
      '¥': 'JPY',
    };

    for (const line of lines) {
      for (const [symbol, code] of Object.entries(currencySymbols)) {
        if (line.includes(symbol)) return code;
      }
    }

    return 'INR'; // Default
  }

  /**
   * Categorize items using semantic analysis
   */
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
    const categoryKeywords: Record<string, string[]> = {
      'Food & Dining': ['burger', 'pizza', 'salad', 'steak', 'pasta', 'rice', 'curry', 'sushi', 'sandwich', 'coffee', 'tea', 'drink', 'wine', 'beer', 'dessert', 'appetizer', 'main course'],
      'Transportation': ['uber', 'ola', 'taxi', 'bus', 'train', 'metro', 'fuel', 'gas', 'parking', 'toll', 'flight', 'airline'],
      'Accommodation': ['hotel', 'room', 'resort', 'hostel', 'airbnb', 'rent', 'stay'],
      'Entertainment': ['movie', 'game', 'ticket', 'show', 'concert', 'sport', 'park', 'museum', 'zoo'],
      'Shopping': ['shirt', 'pant', 'dress', 'shoe', 'bag', 'watch', 'jewelry', 'electronic', 'phone', 'laptop'],
      'Groceries': ['milk', 'bread', 'egg', 'vegetable', 'fruit', 'rice', 'flour', 'sugar', 'oil', 'spice'],
      'Healthcare': ['medicine', 'doctor', 'hospital', 'pharmacy', 'clinic', 'vitamin', 'supplement'],
      'Utilities': ['electricity', 'water', 'gas', 'internet', 'phone', 'bill', 'recharge'],
    };

    return items.map(item => {
      const itemNameLower = item.name.toLowerCase();
      
      for (const [category, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => itemNameLower.includes(keyword))) {
          return { ...item, category };
        }
      }

      return item; // Keep as 'Other' if no match
    });
  }
}

export const ocrProcessor = new OCRProcessor();