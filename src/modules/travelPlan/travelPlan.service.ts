// travelPlan.service.ts

import {
  TravelPlan, ITravelPlan,
  IChecklistItem, IItineraryDay, IFlightDetail,
  IAccommodationDetail, ITransportDetail, IDocumentDetail, IPackingItem,
  IContact
} from './travelPlan.model';
import { Stop } from '../trips/stop.model';
import { ITrip, Trip } from '../trips/trip.model';
import { AppError } from '@/shared/errors/AppError';

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ─────────────────────────────────────────────────────────────────────────────

class TravelPlanService {
  private buildAtomicSet(arrayPath: string, updates: Record<string, any>): Record<string, any> {
    return Object.entries(updates).reduce((acc, [key, value]) => {
      if (value !== undefined) acc[`${arrayPath}.$.${key}`] = value;
      return acc;
    }, {} as Record<string, any>);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CONTACT HELPERS
  // ───────────────────────────────────────────────────────────────────────────

  private getDefaultContacts(): Partial<IContact>[] {
    return [
      {
        type: 'emergency',
        name: 'Emergency Contact',
        phone: '',
        relation: '',
        email: '',
        isPrimary: true,
      },
      {
        type: 'insurance',
        name: 'Travel Insurance',
        phone: '',
        provider: '',
        policyNo: '',
        coverage: '',
        isPrimary: true,
      },
      {
        type: 'hotel',
        name: 'Hotel',
        phone: '',
        address: '',
        isPrimary: true,
      },
      {
        type: 'embassy',
        name: 'Embassy',
        phone: '',
        address: '',
        country: '',
        email: '',
        workingHours: '',
        isPrimary: true,
      },
      {
        type: 'localEmergency',
        name: 'Police',
        phone: '',
        isPrimary: true,
      },
      {
        type: 'localEmergency',
        name: 'Ambulance',
        phone: '',
        isPrimary: false,
      },
      {
        type: 'localEmergency',
        name: 'Fire',
        phone: '',
        isPrimary: false,
      },
    ];
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PLAN CRUD
  // ───────────────────────────────────────────────────────────────────────────

  // async getOrCreatePlan(tripId: string): Promise<ITravelPlan> {
  //   const trip = await Trip.findById(tripId);
  //   if (!trip) throw new AppError('Trip not found', 404);

  //   let plan = await TravelPlan.findOne({ tripId });

  //   if (!plan) {
  //     plan = await TravelPlan.create({
  //       tripId,
  //       groupSize: trip.getActiveMembers().length,
  //       'budgetOverview.total': trip.totalBudget || 0,
  //       'budgetOverview.currency': trip.baseCurrency || 'USD',
  //       'budgetOverview.spent': trip.totalSpentBase || 0,
  //       importantContacts: this.getDefaultContacts(),
  //     });
  //   } else {
  //     // Sync budget from Trip model dynamically
  //     plan.budgetOverview.total = trip.totalBudget || plan.budgetOverview.total;
  //     plan.budgetOverview.spent = trip.totalSpentBase || 0;
  //     plan.budgetOverview.currency = trip.baseCurrency || plan.budgetOverview.currency;
  //     plan.groupSize = trip.getActiveMembers().length;

  //     // Ensure importantContacts exists
  //     if (!plan.importantContacts || plan.importantContacts.length === 0) {
  //       plan.importantContacts = this.getDefaultContacts() as any;
  //     }

  //     await plan.save();
  //   }

  //   return plan;
  // }
  async getOrCreatePlan(tripId: string): Promise<ITravelPlan> {
    const trip = await Trip.findById(tripId);
    if (!trip) throw new AppError('Trip not found', 404);

    let plan = await TravelPlan.findOne({ tripId });

    if (!plan) {
      plan = await TravelPlan.create({
        tripId,
        groupSize: trip.getActiveMembers().length,
        'budgetOverview.total': trip.totalBudget || 0,
        'budgetOverview.currency': trip.baseCurrency || 'USD',
        'budgetOverview.spent': trip.totalSpentBase || 0,
        importantContacts: [
          {
            type: 'emergency',
            name: 'Emergency Contact',
            phone: 'Not provided',  // ← Add placeholder
            relation: '',
            email: '',
            isPrimary: true,
          },
          {
            type: 'insurance',
            name: 'Travel Insurance',
            phone: 'Not provided',  // ← Add placeholder
            provider: '',
            policyNo: '',
            coverage: '',
            isPrimary: true,
          },
          {
            type: 'hotel',
            name: 'Hotel',
            phone: 'Not provided',  // ← Add placeholder
            address: '',
            isPrimary: true,
          },
          {
            type: 'embassy',
            name: 'Embassy',
            phone: 'Not provided',  // ← Add placeholder
            address: '',
            country: '',
            email: '',
            workingHours: '',
            isPrimary: true,
          },
          {
            type: 'localEmergency',
            name: 'Police',
            phone: 'Not provided',  // ← Add placeholder
            isPrimary: true,
          },
          {
            type: 'localEmergency',
            name: 'Ambulance',
            phone: 'Not provided',  // ← Add placeholder
            isPrimary: false,
          },
          {
            type: 'localEmergency',
            name: 'Fire',
            phone: 'Not provided',  // ← Add placeholder
            isPrimary: false,
          },
        ]
      });
    }

    return plan;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CONTACTS MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  async getContacts(tripId: string): Promise<IContact[]> {
    const plan = await TravelPlan.findOne({ tripId }).select('importantContacts');
    if (!plan) throw new AppError('Plan not found', 404);
    return plan.importantContacts || [];
  }
  async addContact(tripId: string, contactData: Partial<IContact>): Promise<ITravelPlan> {
    if (!contactData.type) {
      throw new AppError('Contact type is required', 400);
    }

    // Ensure phone is provided
    if (!contactData.phone) {
      contactData.phone = 'Not provided';
    }

    // Ensure name is provided
    if (!contactData.name) {
      contactData.name = 'Unnamed Contact';
    }

    const existingPlan = await TravelPlan.findOne({ tripId });
    const hasSameType = existingPlan?.importantContacts?.some(
      (c: any) => c.type === contactData.type
    );

    const isPrimary = contactData.isPrimary !== undefined ? contactData.isPrimary : !hasSameType;

    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      {
        $push: {
          importantContacts: {
            ...contactData,
            isPrimary
          }
        }
      },
      { new: true }
    );

    if (!plan) throw new AppError('Travel plan not found', 404);

    if (isPrimary) {
      const lastContact = plan.importantContacts[plan.importantContacts.length - 1];
      if (lastContact && lastContact._id) {
        await this.setPrimaryContact(tripId, lastContact._id.toString(), contactData.type);
      }
    }

    await plan.save();
    return plan;
  }

  // async addContact(tripId: string, contactData: Partial<IContact>): Promise<ITravelPlan> {
  //   if (!contactData.type) {
  //     throw new AppError('Contact type is required', 400);
  //   }

  //   // Check if there are existing contacts of this type
  //   const existingPlan = await TravelPlan.findOne({ tripId });
  //   const hasSameType = existingPlan?.importantContacts?.some(
  //     (c: any) => c.type === contactData.type
  //   );

  //   // If no contacts of this type exist, make this one primary
  //   const isPrimary = contactData.isPrimary !== undefined ? contactData.isPrimary : !hasSameType;

  //   const plan = await TravelPlan.findOneAndUpdate(
  //     { tripId },
  //     {
  //       $push: {
  //         importantContacts: {
  //           ...contactData,
  //           isPrimary
  //         }
  //       }
  //     },
  //     { new: true }
  //   );

  //   if (!plan) throw new AppError('Travel plan not found', 404);

  //   // If this contact is set as primary, unset others of same type
  //   if (isPrimary) {
  //     const lastContact = plan.importantContacts[plan.importantContacts.length - 1];
  //     if (lastContact && lastContact._id) {
  //       await this.setPrimaryContact(tripId, lastContact._id.toString(), contactData.type);
  //     }
  //   }

  //   await plan.save();
  //   return plan;
  // }

  async updateContact(tripId: string, contactId: string, updates: Partial<IContact>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId, 'importantContacts._id': contactId },
      { $set: this.buildAtomicSet('importantContacts', updates) },
      { new: true }
    );

    if (!plan) throw new AppError('Contact not found', 404);

    // If this contact is set as primary, unset others of same type
    if (updates.isPrimary) {
      const contact = plan.importantContacts.id(contactId);
      if (contact) {
        await this.setPrimaryContact(tripId, contactId, contact.type);
      }
    }

    await plan.save();
    return plan;
  }

  async deleteContact(tripId: string, contactId: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $pull: { importantContacts: { _id: contactId } } },
      { new: true }
    );

    if (!plan) throw new AppError('Travel plan not found', 404);
    await plan.save();
    return plan;
  }

  async setPrimaryContact(tripId: string, contactId: string, type: string): Promise<ITravelPlan> {
    // First, unset primary for all contacts of this type
    await TravelPlan.updateOne(
      { tripId },
      { $set: { 'importantContacts.$[elem].isPrimary': false } },
      { arrayFilters: [{ 'elem.type': type }] }
    );

    // Then set the specific contact as primary
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId, 'importantContacts._id': contactId },
      { $set: { 'importantContacts.$.isPrimary': true } },
      { new: true }
    );

    if (!plan) throw new AppError('Contact not found', 404);
    await plan.save();
    return plan;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // UPDATE PLAN
  // ───────────────────────────────────────────────────────────────────────────

  async updatePlan(tripId: string, updateData: Partial<ITravelPlan>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $set: updateData },
      { new: true, runValidators: true }
    );
    if (!plan) throw new AppError('Failed to update travel plan', 404);
    return plan;
  }

  async updatePlanSection(tripId: string, section: keyof ITravelPlan, data: any): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $set: { [section]: data } },
      { new: true, runValidators: true }
    );
    if (!plan) throw new AppError('Failed to update travel plan section', 404);
    return plan;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BUDGET MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  async updateBudget(tripId: string, budgetData: Partial<ITravelPlan['budgetOverview']>): Promise<ITravelPlan> {
    const setUpdates = Object.entries(budgetData).reduce((acc, [key, val]) => {
      if (val !== undefined) acc[`budgetOverview.${key}`] = val;
      return acc;
    }, {} as Record<string, any>);

    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $set: setUpdates },
      { new: true }
    );

    if (!plan) throw new AppError('Travel plan not found', 404);

    if (budgetData.total !== undefined) {
      await Trip.findByIdAndUpdate(tripId, { totalBudget: budgetData.total });
    }

    await plan.save();
    return plan;
  }

  async getBudgetAnalysis(tripId: string) {
    const [plan, trip, stops] = await Promise.all([
      TravelPlan.findOne({ tripId }),
      Trip.findById(tripId).select('totalSpentBase stops'),
      Stop.find({ tripId }).select('name totalSpentBase totalSpentLocal currency budget budgetBase').sort({ order: 1 })
    ]);

    if (!plan || !trip) throw new AppError('Data not found', 404);

    const b = plan.budgetOverview;
    const totalEstimated = b.flights + b.accommodation + b.transport + b.food + b.activities + b.shopping + b.miscellaneous;
    const totalBudget = b.total || totalEstimated;
    const totalSpent = trip.totalSpentBase || 0;

    const calcPerc = (val: number) => totalEstimated > 0 ? Math.round((val / totalEstimated) * 100) : 0;

    return {
      overview: {
        totalBudget,
        totalEstimated,
        totalSpent,
        remaining: totalBudget - totalSpent,
        utilizationPercentage: totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0,
        currency: b.currency,
      },
      categories: {
        flights: { estimated: b.flights, percentage: calcPerc(b.flights) },
        accommodation: { estimated: b.accommodation, percentage: calcPerc(b.accommodation) },
        transport: { estimated: b.transport, percentage: calcPerc(b.transport) },
        food: { estimated: b.food, percentage: calcPerc(b.food) },
        activities: { estimated: b.activities, percentage: calcPerc(b.activities) },
        shopping: { estimated: b.shopping, percentage: calcPerc(b.shopping) },
        miscellaneous: { estimated: b.miscellaneous, percentage: calcPerc(b.miscellaneous) },
      },
      plannedCosts: {
        flights: plan.flightDetails.reduce((sum: number, f: IFlightDetail) => sum + (f.cost || 0), 0),
        accommodation: plan.accommodationDetails.reduce((sum: number, a: IAccommodationDetail) => sum + (a.cost || 0), 0),
        transport: plan.transportDetails.reduce((sum: number, t: ITransportDetail) => sum + (t.cost || 0), 0),
      },
      stopBreakdown: stops.map((stop: any) => ({
        stopId: stop._id,
        name: stop.name,
        spent: stop.totalSpentBase,
        spentLocal: stop.totalSpentLocal,
        currency: stop.currency,
        budget: stop.budgetBase || 0,
        percentage: totalSpent > 0 ? Math.round((stop.totalSpentBase / totalSpent) * 100) : 0,
      })),
      alerts: this.generateBudgetAlerts(totalSpent, totalBudget),
    };
  }

  private generateBudgetAlerts(totalSpent: number, totalBudget: number) {
    const alerts: Array<{ type: 'critical' | 'warning' | 'info'; message: string }> = [];
    if (totalBudget > 0) {
      const utilization = (totalSpent / totalBudget) * 100;
      if (utilization >= 90) alerts.push({ type: 'critical', message: `Budget almost exhausted! Only ${Math.round(100 - utilization)}% remaining.` });
      else if (utilization >= 75) alerts.push({ type: 'warning', message: `Budget ${Math.round(utilization)}% utilized.` });
      else if (utilization >= 50) alerts.push({ type: 'info', message: `Budget ${Math.round(utilization)}% utilized.` });
    }
    return alerts;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // CHECKLIST MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  async addChecklistItem(tripId: string, item: Omit<IChecklistItem, '_id' | 'checked'>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $push: { checklist: { ...item, checked: false } } },
      { new: true }
    );
    if (!plan) throw new AppError('Plan not found', 404);
    return plan;
  }

  async toggleChecklistItem(tripId: string, itemId: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOne({ tripId });
    if (!plan) throw new AppError('Travel plan not found', 404);

    const item = plan.checklist.id(itemId);
    if (!item) throw new AppError('Checklist item not found', 404);

    item.checked = !item.checked;
    await plan.save();
    return plan;
  }

  async updateChecklistItem(tripId: string, itemId: string, updates: Partial<IChecklistItem>): Promise<ITravelPlan> {
    const setUpdates = this.buildAtomicSet('checklist', updates);
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId, 'checklist._id': itemId },
      { $set: setUpdates },
      { new: true }
    );
    if (!plan) throw new AppError('Item or Plan not found', 404);
    await plan.save();
    return plan;
  }

  async deleteChecklistItem(tripId: string, itemId: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $pull: { checklist: { _id: itemId } } },
      { new: true }
    );
    if (!plan) throw new AppError('Travel plan not found', 404);
    await plan.save();
    return plan;
  }

  async getUrgentChecklistItems(tripId: string) {
    const plan = await TravelPlan.findOne({ tripId }).select('checklist');
    if (!plan) return [];
    const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    return plan.checklist.filter((i: IChecklistItem) => !i.checked && i.priority === 'high' && i.dueDate && new Date(i.dueDate) <= threeDays);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // ITINERARY MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  async addItineraryDay(tripId: string, dayData: Partial<IItineraryDay>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOne({ tripId });
    if (!plan) throw new AppError('Plan not found', 404);

    const dayNumber = plan.itinerary.length + 1;
    plan.itinerary.push({ ...dayData, day: `Day ${dayNumber}` } as any);
    await plan.save();
    return plan;
  }

  async updateItineraryDay(tripId: string, dayId: string, updates: Partial<IItineraryDay>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId, 'itinerary._id': dayId },
      { $set: this.buildAtomicSet('itinerary', updates) },
      { new: true }
    );
    if (!plan) throw new AppError('Itinerary day not found', 404);
    return plan;
  }

  async deleteItineraryDay(tripId: string, dayId: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $pull: { itinerary: { _id: dayId } } },
      { new: true }
    );
    if (!plan) throw new AppError('Travel plan not found', 404);
    return plan;
  }

  async generateItineraryFromStops(tripId: string): Promise<ITravelPlan> {
    const trip = await Trip.findById(tripId).populate('stops');
    if (!trip) throw new AppError('Trip not found', 404);

    const plan = await this.getOrCreatePlan(tripId);

    plan.itinerary = [] as any;
    trip.stops.forEach((stop: any, idx: number) => {
      plan.itinerary.push({
        date: stop.startDate || trip.startDate,
        day: `Day ${idx + 1}`,
        destination: stop.name,
        stopId: stop._id,
        location: stop.location,
        transport: '',
        accommodation: '',
        meals: {},
        notes: stop.notes || '',
      } as any);
    });

    await plan.save();
    return plan;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // BOOKINGS (FLIGHTS, ACCOMMODATION, TRANSPORT)
  // ───────────────────────────────────────────────────────────────────────────

  async addFlight(tripId: string, data: Omit<IFlightDetail, '_id'>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $push: { flightDetails: data } },
      { new: true }
    );
    if (!plan) throw new AppError('Plan not found', 404);
    await plan.save();
    return plan;
  }

  async updateFlight(tripId: string, id: string, updates: Partial<IFlightDetail>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId, 'flightDetails._id': id },
      { $set: this.buildAtomicSet('flightDetails', updates) },
      { new: true }
    );
    if (!plan) throw new AppError('Flight not found', 404);
    await plan.save();
    return plan;
  }

  async deleteFlight(tripId: string, id: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $pull: { flightDetails: { _id: id } } },
      { new: true }
    );
    if (!plan) throw new AppError('Plan not found', 404);
    await plan.save();
    return plan;
  }

  async getUpcomingFlights(tripId: string) {
    const plan = await TravelPlan.findOne({ tripId }).select('flightDetails');
    if (!plan) throw new AppError('Travel plan not found', 404);
    const now = new Date();
    return plan.flightDetails
      .filter((f: IFlightDetail) => f.date && new Date(f.date) >= now)
      .sort((a: IFlightDetail, b: IFlightDetail) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  async addAccommodation(tripId: string, data: Omit<IAccommodationDetail, '_id'>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $push: { accommodationDetails: data } },
      { new: true }
    );
    if (!plan) throw new AppError('Plan not found', 404);
    await plan.save();
    return plan;
  }

  async updateAccommodation(tripId: string, id: string, updates: Partial<IAccommodationDetail>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId, 'accommodationDetails._id': id },
      { $set: this.buildAtomicSet('accommodationDetails', updates) },
      { new: true }
    );
    if (!plan) throw new AppError('Accommodation not found', 404);
    await plan.save();
    return plan;
  }

  async deleteAccommodation(tripId: string, id: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $pull: { accommodationDetails: { _id: id } } },
      { new: true }
    );
    if (!plan) throw new AppError('Plan not found', 404);
    await plan.save();
    return plan;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TRANSPORT MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  async addTransport(tripId: string, data: Omit<ITransportDetail, '_id'>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $push: { transportDetails: data } },
      { new: true }
    );
    if (!plan) throw new AppError('Failed to add transport', 500);
    await plan.save();
    return plan;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PACKING LIST MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  async addPackingItem(tripId: string, data: { category: string, name: string, quantity?: number, priority?: string }): Promise<ITravelPlan> {
    let plan = await TravelPlan.findOneAndUpdate(
      { tripId, 'packingList.category': new RegExp(`^${data.category}$`, 'i') },
      { $push: { 'packingList.$.items': { name: data.name, checked: false, quantity: data.quantity || 1, priority: data.priority || 'recommended' } } },
      { new: true }
    );

    if (!plan) {
      plan = await TravelPlan.findOneAndUpdate(
        { tripId },
        { $push: { packingList: { category: data.category, items: [{ name: data.name, checked: false, quantity: data.quantity || 1, priority: data.priority || 'recommended' }] } } },
        { new: true }
      );
    }

    if (!plan) throw new AppError('Travel plan not found', 404);
    await plan.save();
    return plan;
  }

  async togglePackingItem(tripId: string, categoryId: string, itemId: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOne({ tripId });
    if (!plan) throw new AppError('Plan not found', 404);

    const category = plan.packingList.id(categoryId);
    if (!category) throw new AppError('Category not found', 404);

    const item = category.items.id(itemId);
    if (!item) throw new AppError('Item not found', 404);

    item.checked = !item.checked;
    await plan.save();
    return plan;
  }

  getDefaultPackingList(travelStyle: ITravelPlan['travelStyle'] = 'comfort') {
    const baseList = [
      {
        category: 'Clothing',
        icon: '👕',
        items: [
          { name: 'T-shirts', quantity: 4, priority: 'essential' },
          { name: 'Pants/Shorts', quantity: 3, priority: 'essential' },
          { name: 'Underwear', quantity: 7, priority: 'essential' },
          { name: 'Socks', quantity: 7, priority: 'essential' },
          { name: 'Sleepwear', quantity: 1, priority: 'recommended' },
        ],
      },
      {
        category: 'Toiletries',
        icon: '🧴',
        items: [
          { name: 'Toothbrush & toothpaste', quantity: 1, priority: 'essential' },
          { name: 'Shampoo & conditioner', quantity: 1, priority: 'essential' },
          { name: 'Sunscreen', quantity: 1, priority: 'essential' },
          { name: 'Deodorant', quantity: 1, priority: 'essential' },
        ],
      },
      {
        category: 'Electronics',
        icon: '📱',
        items: [
          { name: 'Phone charger', quantity: 1, priority: 'essential' },
          { name: 'Power bank', quantity: 1, priority: 'recommended' },
          { name: 'Universal adapter', quantity: 1, priority: 'essential' },
          { name: 'Headphones', quantity: 1, priority: 'optional' },
        ],
      },
      {
        category: 'Documents',
        icon: '📄',
        items: [
          { name: 'Passport', quantity: 1, priority: 'essential' },
          { name: 'Visa (if required)', quantity: 1, priority: 'essential' },
          { name: 'Travel insurance', quantity: 1, priority: 'essential' },
          { name: 'Flight tickets (printed)', quantity: 1, priority: 'recommended' },
          { name: 'Hotel reservations', quantity: 1, priority: 'recommended' },
        ],
      },
      {
        category: 'Health & Safety',
        icon: '💊',
        items: [
          { name: 'First aid kit', quantity: 1, priority: 'essential' },
          { name: 'Prescription medications', quantity: 1, priority: 'essential' },
          { name: 'Hand sanitizer', quantity: 1, priority: 'recommended' },
          { name: 'Face masks', quantity: 5, priority: 'optional' },
        ],
      },
    ];

    if (travelStyle === 'luxury') {
      baseList.push({
        category: 'Luxury Extras',
        icon: '✨',
        items: [
          { name: 'Formal wear', quantity: 1, priority: 'recommended' },
          { name: 'Perfume/Cologne', quantity: 1, priority: 'optional' },
          { name: 'Jewelry', quantity: 1, priority: 'optional' },
        ],
      });
    } else if (travelStyle === 'backpacking') {
      baseList.push({
        category: 'Backpacking Gear',
        icon: '🎒',
        items: [
          { name: 'Sleeping bag', quantity: 1, priority: 'essential' },
          { name: 'Water bottle', quantity: 1, priority: 'essential' },
          { name: 'Multi-tool', quantity: 1, priority: 'recommended' },
          { name: 'Flashlight', quantity: 1, priority: 'essential' },
        ],
      });
    } else if (travelStyle === 'business') {
      baseList.push({
        category: 'Business Essentials',
        icon: '💼',
        items: [
          { name: 'Laptop & charger', quantity: 1, priority: 'essential' },
          { name: 'Business cards', quantity: 20, priority: 'recommended' },
          { name: 'Formal shoes', quantity: 1, priority: 'essential' },
          { name: 'Notebook & pen', quantity: 1, priority: 'recommended' },
        ],
      });
    }

    return baseList;
  }

  async initializeDefaultPackingList(tripId: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOne({ tripId });
    if (!plan) throw new AppError('Travel plan not found', 404);

    plan.packingList = this.getDefaultPackingList(plan.travelStyle) as any;
    await plan.save();
    return plan;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DOCUMENTS & ANALYTICS
  // ───────────────────────────────────────────────────────────────────────────

  async addDocument(tripId: string, documentData: Omit<IDocumentDetail, '_id' | 'verified'>): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $push: { documents: { ...documentData, verified: false } } },
      { new: true }
    );
    if (!plan) throw new AppError('Failed to add document', 500);
    await plan.save();
    return plan;
  }

  async verifyDocument(tripId: string, documentId: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId, 'documents._id': documentId },
      { $set: { 'documents.$.verified': true } },
      { new: true }
    );
    if (!plan) throw new AppError('Document not found', 404);
    await plan.save();
    return plan;
  }

  async getExpiringDocuments(tripId: string) {
    const plan = await TravelPlan.findOne({ tripId }).select('documents');
    if (!plan) throw new AppError('Travel plan not found', 404);

    const now = new Date();
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    return plan.documents.filter(
      (doc: IDocumentDetail) => doc.expiryDate &&
        new Date(doc.expiryDate) <= thirtyDaysFromNow &&
        new Date(doc.expiryDate) > now
    );
  }

  async getPlanningProgress(tripId: string) {
    const [plan, trip] = await Promise.all([
      TravelPlan.findOne({ tripId }),
      Trip.findById(tripId).select('status startDate')
    ]);

    const now = new Date();
    const daysUntilTrip = trip?.startDate ? Math.ceil((new Date(trip.startDate).getTime() - now.getTime()) / 86400000) : null;

    if (!plan) {
      return {
        overall: 0,
        checklist: 0,
        packing: 0,
        bookings: 0,
        documents: 0,
        tripStatus: trip?.status || 'planning',
        daysUntilTrip,
        urgentItems: [],
        expiringDocs: [],
        upcomingFlights: []
      };
    }

    const thirtyDays = new Date(now.getTime() + 30 * 86400000);

    return {
      progress: plan.planningProgress,
      tripStatus: trip?.status || 'planning',
      daysUntilTrip,
      urgentItems: await this.getUrgentChecklistItems(tripId),
      expiringDocs: plan.documents.filter((d: IDocumentDetail) => d.expiryDate && new Date(d.expiryDate) <= thirtyDays && new Date(d.expiryDate) > now),
      upcomingFlights: plan.flightDetails.filter((f: IFlightDetail) => f.date && new Date(f.date) >= now).sort((a: IFlightDetail, b: IFlightDetail) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    };
  }

  async getTripSummary(tripId: string) {
    const [plan, trip] = await Promise.all([
      TravelPlan.findOne({ tripId }),
      Trip.findById(tripId).select('title status startDate endDate members totalSpentBase'),
    ]);

    if (!trip) throw new AppError('Trip not found', 404);

    return {
      trip: {
        id: trip._id,
        title: trip.title,
        status: trip.status,
        startDate: trip.startDate,
        endDate: trip.endDate,
        daysUntilTrip: trip.startDate ? Math.ceil((new Date(trip.startDate).getTime() - Date.now()) / 86400000) : null,
        memberCount: trip.members.filter((m: any) => m.isActive).length,
        totalSpent: trip.totalSpentBase,
      },
      plan: plan ? {
        progress: plan.planningProgress.overall,
        itineraryDays: plan.itinerary.length,
        checklistCompleted: plan.checklist.filter((i: IChecklistItem) => i.checked).length,
        checklistTotal: plan.checklist.length,
        packingProgress: plan.planningProgress.packing,
        flightsBooked: plan.flightDetails.filter((f: IFlightDetail) => f.status === 'confirmed').length,
        accommodationsBooked: plan.accommodationDetails.length,
        budgetUtilization: plan.budgetOverview.total > 0 ? Math.round((plan.budgetOverview.spent / plan.budgetOverview.total) * 100) : 0,
      } : null,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TRIP ACTIVATION
  // ───────────────────────────────────────────────────────────────────────────

  async validateTripReadyForActivation(tripId: string): Promise<{ ready: boolean; issues: string[]; warnings: string[]; }> {
    const plan = await TravelPlan.findOne({ tripId });
    const issues: string[] = [];
    const warnings: string[] = [];

    if (!plan) return { ready: false, issues: ['Travel plan has not been created'], warnings };

    if (plan.itinerary.length === 0) issues.push('No itinerary days added');
    if (plan.flightDetails.length === 0) warnings.push('No flights added');
    if (plan.accommodationDetails.length === 0) warnings.push('No accommodation booked');
    if (plan.checklist.some((i: IChecklistItem) => !i.checked && i.priority === 'high')) warnings.push('High priority checklist items remaining');
    if (!plan.documents.some((d: IDocumentDetail) => d.type === 'passport' && d.verified)) warnings.push('Passport not verified');
    if (plan.budgetOverview.total === 0) warnings.push('Budget not set');

    return { ready: issues.length === 0, issues, warnings };
  }

  async activateTrip(tripId: string): Promise<{ trip: ITrip; plan: ITravelPlan }> {
    const validation = await this.validateTripReadyForActivation(tripId);
    if (!validation.ready) throw new AppError(`Cannot activate trip: ${validation.issues.join(', ')}`, 400);

    const [trip, plan] = await Promise.all([
      Trip.findByIdAndUpdate(tripId, { status: 'active' }, { new: true }),
      TravelPlan.findOne({ tripId })
    ]);

    if (!trip || !plan) throw new AppError('Trip or plan not found', 404);
    return { trip, plan };
  }

  async completeTrip(tripId: string) {
    const trip = await Trip.findByIdAndUpdate(
      tripId,
      { status: 'completed' },
      { new: true }
    );

    if (!trip) throw new AppError('Trip not found', 404);

    const summary = await this.getTripSummary(tripId);
    return { trip, summary };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // TRANSPORT MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  async deleteTransport(tripId: string, transportId: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOneAndUpdate(
      { tripId },
      { $pull: { transportDetails: { _id: transportId } } },
      { new: true }
    );
    if (!plan) throw new AppError('Travel plan not found', 404);
    await plan.save();
    return plan;
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PACKING LIST MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  async deletePackingItem(tripId: string, categoryId: string, itemId: string): Promise<ITravelPlan> {
    const plan = await TravelPlan.findOne({ tripId });
    if (!plan) throw new AppError('Travel plan not found', 404);

    const category = plan.packingList.id(categoryId);
    if (!category) throw new AppError('Category not found', 404);

    const itemIndex = category.items.findIndex((item: any) => item._id?.toString() === itemId);
    if (itemIndex === -1) throw new AppError('Item not found', 404);

    category.items.splice(itemIndex, 1);

    // If category is empty, remove it
    if (category.items.length === 0) {
      plan.packingList.pull(categoryId);
    }

    await plan.save();
    return plan;
  }
}
export const travelPlanService = new TravelPlanService();



