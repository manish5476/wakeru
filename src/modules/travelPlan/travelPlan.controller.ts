// travelPlan.controller.ts

import { Request, Response, NextFunction } from 'express';
import { travelPlanService } from './travelPlan.service';
import { AppError } from '../../shared/errors/AppError';
import { TravelPlan } from './travelPlan.model'; // Only needed if service doesn't handle it

/**
 * Helper to wrap async route handlers and pass errors to Express NextFunction
 */
const catchAsync = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

export const travelPlanController = {
  // ───────────────────────────────────────────────────────────────────────────
  // PLAN CRUD
  // ───────────────────────────────────────────────────────────────────────────

  getPlan: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.getOrCreatePlan(tripId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  updatePlan: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.updatePlan(tripId, req.body);
    res.status(200).json({ status: 'success', data: plan });
  }),

  updatePlanSection: catchAsync(async (req: Request, res: Response) => {
    const { tripId, section } = req.params;
    const plan = await travelPlanService.updatePlanSection(tripId, section as any, req.body);
    res.status(200).json({ status: 'success', data: plan });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // BUDGET MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  updateBudget: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.updateBudget(tripId, req.body);
    res.status(200).json({ status: 'success', data: plan });
  }),

  getBudgetAnalysis: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const analysis = await travelPlanService.getBudgetAnalysis(tripId);
    res.status(200).json({ status: 'success', data: analysis });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // CHECKLIST MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  addChecklistItem: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.addChecklistItem(tripId, req.body);
    res.status(201).json({ status: 'success', data: plan });
  }),

  toggleChecklistItem: catchAsync(async (req: Request, res: Response) => {
    const { tripId, itemId } = req.params;
    const plan = await travelPlanService.toggleChecklistItem(tripId, itemId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  updateChecklistItem: catchAsync(async (req: Request, res: Response) => {
    const { tripId, itemId } = req.params;
    const plan = await travelPlanService.updateChecklistItem(tripId, itemId, req.body);
    res.status(200).json({ status: 'success', data: plan });
  }),

  deleteChecklistItem: catchAsync(async (req: Request, res: Response) => {
    const { tripId, itemId } = req.params;
    const plan = await travelPlanService.deleteChecklistItem(tripId, itemId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  getUrgentChecklistItems: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const items = await travelPlanService.getUrgentChecklistItems(tripId);
    res.status(200).json({ status: 'success', data: items });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // ITINERARY MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  addItineraryDay: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.addItineraryDay(tripId, req.body);
    res.status(201).json({ status: 'success', data: plan });
  }),

  updateItineraryDay: catchAsync(async (req: Request, res: Response) => {
    const { tripId, dayId } = req.params;
    const plan = await travelPlanService.updateItineraryDay(tripId, dayId, req.body);
    res.status(200).json({ status: 'success', data: plan });
  }),

  deleteItineraryDay: catchAsync(async (req: Request, res: Response) => {
    const { tripId, dayId } = req.params;
    const plan = await travelPlanService.deleteItineraryDay(tripId, dayId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  generateItineraryFromStops: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.generateItineraryFromStops(tripId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // FLIGHT MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  addFlight: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.addFlight(tripId, req.body);
    res.status(201).json({ status: 'success', data: plan });
  }),

  updateFlight: catchAsync(async (req: Request, res: Response) => {
    const { tripId, flightId } = req.params;
    const plan = await travelPlanService.updateFlight(tripId, flightId, req.body);
    res.status(200).json({ status: 'success', data: plan });
  }),

  deleteFlight: catchAsync(async (req: Request, res: Response) => {
    const { tripId, flightId } = req.params;
    const plan = await travelPlanService.deleteFlight(tripId, flightId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  getUpcomingFlights: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const flights = await travelPlanService.getUpcomingFlights(tripId);
    res.status(200).json({ status: 'success', data: flights });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // CONTACTS MANAGEMENT - NOW ALL USING travelPlanService
  // ───────────────────────────────────────────────────────────────────────────

  getContacts: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const contacts = await travelPlanService.getContacts(tripId);
    res.status(200).json({ status: 'success', data: contacts });
  }),

  addContact: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.addContact(tripId, req.body);
    res.status(201).json({ status: 'success', data: plan });
  }),

  updateContact: catchAsync(async (req: Request, res: Response) => {
    const { tripId, contactId } = req.params;
    const plan = await travelPlanService.updateContact(tripId, contactId, req.body);
    res.status(200).json({ status: 'success', data: plan });
  }),

  deleteContact: catchAsync(async (req: Request, res: Response) => {
    const { tripId, contactId } = req.params;
    const plan = await travelPlanService.deleteContact(tripId, contactId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  setPrimaryContact: catchAsync(async (req: Request, res: Response) => {
    const { tripId, contactId } = req.params;
    const { type } = req.body;
    const plan = await travelPlanService.setPrimaryContact(tripId, contactId, type);
    res.status(200).json({ status: 'success', data: plan });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // ACCOMMODATION MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  addAccommodation: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.addAccommodation(tripId, req.body);
    res.status(201).json({ status: 'success', data: plan });
  }),

  updateAccommodation: catchAsync(async (req: Request, res: Response) => {
    const { tripId, accommodationId } = req.params;
    const plan = await travelPlanService.updateAccommodation(tripId, accommodationId, req.body);
    res.status(200).json({ status: 'success', data: plan });
  }),

  deleteAccommodation: catchAsync(async (req: Request, res: Response) => {
    const { tripId, accommodationId } = req.params;
    const plan = await travelPlanService.deleteAccommodation(tripId, accommodationId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // TRANSPORT MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  addTransport: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.addTransport(tripId, req.body);
    res.status(201).json({ status: 'success', data: plan });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // PACKING LIST MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  addPackingItem: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.addPackingItem(tripId, req.body);
    res.status(201).json({ status: 'success', data: plan });
  }),

  togglePackingItem: catchAsync(async (req: Request, res: Response) => {
    const { tripId, categoryId, itemId } = req.params;
    const plan = await travelPlanService.togglePackingItem(tripId, categoryId, itemId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  initializeDefaultPackingList: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.initializeDefaultPackingList(tripId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // DOCUMENTS MANAGEMENT
  // ───────────────────────────────────────────────────────────────────────────

  addDocument: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const plan = await travelPlanService.addDocument(tripId, req.body);
    res.status(201).json({ status: 'success', data: plan });
  }),

  verifyDocument: catchAsync(async (req: Request, res: Response) => {
    const { tripId, documentId } = req.params;
    const plan = await travelPlanService.verifyDocument(tripId, documentId);
    res.status(200).json({ status: 'success', data: plan });
  }),

  getExpiringDocuments: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const documents = await travelPlanService.getExpiringDocuments(tripId);
    res.status(200).json({ status: 'success', data: documents });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // ANALYTICS & PROGRESS
  // ───────────────────────────────────────────────────────────────────────────

  getPlanningProgress: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const progress = await travelPlanService.getPlanningProgress(tripId);
    res.status(200).json({ status: 'success', data: progress });
  }),

  getTripSummary: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const summary = await travelPlanService.getTripSummary(tripId);
    res.status(200).json({ status: 'success', data: summary });
  }),

  // ───────────────────────────────────────────────────────────────────────────
  // TRIP ACTIVATION
  // ───────────────────────────────────────────────────────────────────────────

  validateTripReadyForActivation: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const validation = await travelPlanService.validateTripReadyForActivation(tripId);
    res.status(200).json({ status: 'success', data: validation });
  }),

  activateTrip: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const result = await travelPlanService.activateTrip(tripId);
    res.status(200).json({ status: 'success', data: result });
  }),

  completeTrip: catchAsync(async (req: Request, res: Response) => {
    const { tripId } = req.params;
    const result = await travelPlanService.completeTrip(tripId);
    res.status(200).json({ status: 'success', data: result });
  })
};

// import { Request, Response, NextFunction } from 'express';
// import { travelPlanService } from './travelPlan.service';
// import { AppError } from '../../shared/errors/AppError';
// import { TravelPlan } from './travelPlan.model';

// /**
//  * Helper to wrap async route handlers and pass errors to Express NextFunction
//  */
// const catchAsync = (fn: Function) => {
//   return (req: Request, res: Response, next: NextFunction) => {
//     fn(req, res, next).catch(next);
//   };
// };

// export const travelPlanController = {
//   // ───────────────────────────────────────────────────────────────────────────
//   // PLAN CRUD
//   // ───────────────────────────────────────────────────────────────────────────

//   getPlan: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.getOrCreatePlan(tripId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   updatePlan: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.updatePlan(tripId, req.body);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   updatePlanSection: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, section } = req.params;
//     const plan = await travelPlanService.updatePlanSection(tripId, section as any, req.body);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   // ───────────────────────────────────────────────────────────────────────────
//   // BUDGET MANAGEMENT
//   // ───────────────────────────────────────────────────────────────────────────

//   updateBudget: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.updateBudget(tripId, req.body);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   getBudgetAnalysis: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const analysis = await travelPlanService.getBudgetAnalysis(tripId);
//     res.status(200).json({ status: 'success', data: analysis });
//   }),

//   // ───────────────────────────────────────────────────────────────────────────
//   // CHECKLIST MANAGEMENT
//   // ───────────────────────────────────────────────────────────────────────────

//   addChecklistItem: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.addChecklistItem(tripId, req.body);
//     res.status(201).json({ status: 'success', data: plan });
//   }),

//   toggleChecklistItem: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, itemId } = req.params;
//     const plan = await travelPlanService.toggleChecklistItem(tripId, itemId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   updateChecklistItem: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, itemId } = req.params;
//     const plan = await travelPlanService.updateChecklistItem(tripId, itemId, req.body);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   deleteChecklistItem: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, itemId } = req.params;
//     const plan = await travelPlanService.deleteChecklistItem(tripId, itemId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   getUrgentChecklistItems: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const items = await travelPlanService.getUrgentChecklistItems(tripId);
//     res.status(200).json({ status: 'success', data: items });
//   }),

//   // ───────────────────────────────────────────────────────────────────────────
//   // ITINERARY MANAGEMENT
//   // ───────────────────────────────────────────────────────────────────────────

//   addItineraryDay: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.addItineraryDay(tripId, req.body);
//     res.status(201).json({ status: 'success', data: plan });
//   }),

//   updateItineraryDay: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, dayId } = req.params;
//     const plan = await travelPlanService.updateItineraryDay(tripId, dayId, req.body);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   deleteItineraryDay: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, dayId } = req.params;
//     const plan = await travelPlanService.deleteItineraryDay(tripId, dayId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   generateItineraryFromStops: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.generateItineraryFromStops(tripId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   // ───────────────────────────────────────────────────────────────────────────
//   // FLIGHT MANAGEMENT
//   // ───────────────────────────────────────────────────────────────────────────

//   addFlight: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.addFlight(tripId, req.body);
//     res.status(201).json({ status: 'success', data: plan });
//   }),

//   updateFlight: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, flightId } = req.params;
//     const plan = await travelPlanService.updateFlight(tripId, flightId, req.body);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   deleteFlight: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, flightId } = req.params;
//     const plan = await travelPlanService.deleteFlight(tripId, flightId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   getUpcomingFlights: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const flights = await travelPlanService.getUpcomingFlights(tripId);
//     res.status(200).json({ status: 'success', data: flights });
//   }),

//   getContacts: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await TravelPlan.findOne({ tripId }).select('importantContacts');
//     if (!plan) throw new AppError('Plan not found', 404);
//     res.status(200).json({ status: 'success', data: plan.importantContacts });
//   }),

//   addContact: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.addContact(tripId, req.body);
//     res.status(201).json({ status: 'success', data: plan });
//   }),

//   updateContact: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, contactId } = req.params;
//     const plan = await travelPlanService.updateContact(tripId, contactId, req.body);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   deleteContact: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, contactId } = req.params;
//     const plan = await travelPlanService.deleteContact(tripId, contactId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   setPrimaryContact: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, contactId } = req.params;
//     const { type } = req.body;
//     const plan = await travelPlanService.setPrimaryContact(tripId, contactId, type);
//     res.status(200).json({ status: 'success', data: plan });
//   }),
//   // ───────────────────────────────────────────────────────────────────────────
//   // ACCOMMODATION MANAGEMENT
//   // ───────────────────────────────────────────────────────────────────────────

//   addAccommodation: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.addAccommodation(tripId, req.body);
//     res.status(201).json({ status: 'success', data: plan });
//   }),

//   updateAccommodation: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, accommodationId } = req.params;
//     const plan = await travelPlanService.updateAccommodation(tripId, accommodationId, req.body);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   deleteAccommodation: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, accommodationId } = req.params;
//     const plan = await travelPlanService.deleteAccommodation(tripId, accommodationId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   // ───────────────────────────────────────────────────────────────────────────
//   // TRANSPORT MANAGEMENT
//   // ───────────────────────────────────────────────────────────────────────────

//   addTransport: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.addTransport(tripId, req.body);
//     res.status(201).json({ status: 'success', data: plan });
//   }),

//   // ───────────────────────────────────────────────────────────────────────────
//   // PACKING LIST MANAGEMENT
//   // ───────────────────────────────────────────────────────────────────────────

//   addPackingItem: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.addPackingItem(tripId, req.body);
//     res.status(201).json({ status: 'success', data: plan });
//   }),

//   togglePackingItem: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, categoryId, itemId } = req.params;
//     const plan = await travelPlanService.togglePackingItem(tripId, categoryId, itemId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   initializeDefaultPackingList: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.initializeDefaultPackingList(tripId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   // ───────────────────────────────────────────────────────────────────────────
//   // DOCUMENTS MANAGEMENT
//   // ───────────────────────────────────────────────────────────────────────────

//   addDocument: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const plan = await travelPlanService.addDocument(tripId, req.body);
//     res.status(201).json({ status: 'success', data: plan });
//   }),

//   verifyDocument: catchAsync(async (req: Request, res: Response) => {
//     const { tripId, documentId } = req.params;
//     const plan = await travelPlanService.verifyDocument(tripId, documentId);
//     res.status(200).json({ status: 'success', data: plan });
//   }),

//   getExpiringDocuments: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const documents = await travelPlanService.getExpiringDocuments(tripId);
//     res.status(200).json({ status: 'success', data: documents });
//   }),

//   // ───────────────────────────────────────────────────────────────────────────
//   // ANALYTICS & PROGRESS
//   // ───────────────────────────────────────────────────────────────────────────

//   getPlanningProgress: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const progress = await travelPlanService.getPlanningProgress(tripId);
//     res.status(200).json({ status: 'success', data: progress });
//   }),

//   getTripSummary: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const summary = await travelPlanService.getTripSummary(tripId);
//     res.status(200).json({ status: 'success', data: summary });
//   }),

//   // ───────────────────────────────────────────────────────────────────────────
//   // TRIP ACTIVATION
//   // ───────────────────────────────────────────────────────────────────────────

//   validateTripReadyForActivation: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const validation = await travelPlanService.validateTripReadyForActivation(tripId);
//     res.status(200).json({ status: 'success', data: validation });
//   }),

//   activateTrip: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const result = await travelPlanService.activateTrip(tripId);
//     res.status(200).json({ status: 'success', data: result });
//   }),

//   completeTrip: catchAsync(async (req: Request, res: Response) => {
//     const { tripId } = req.params;
//     const result = await travelPlanService.completeTrip(tripId);
//     res.status(200).json({ status: 'success', data: result });
//   })


// };