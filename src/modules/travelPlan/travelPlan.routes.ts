import { Router } from 'express';
import { travelPlanController } from './travelPlan.controller';

const router = Router({ mergeParams: true }); 
// mergeParams is useful if you mount this on a parent route like: app.use('/api/trips/:tripId/plan', travelPlanRoutes)

// ─────────────────────────────────────────────────────────────────────────────
// BASE PLAN ROUTES (/api/trips/:tripId/plan)
// ─────────────────────────────────────────────────────────────────────────────

router.route('/:tripId')
  .get(travelPlanController.getPlan)
  .patch(travelPlanController.updatePlan);

router.patch('/:tripId/section/:section', travelPlanController.updatePlanSection);

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS & PROGRESS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:tripId/progress', travelPlanController.getPlanningProgress);
router.get('/:tripId/summary', travelPlanController.getTripSummary);

// ─────────────────────────────────────────────────────────────────────────────
// BUDGET
// ─────────────────────────────────────────────────────────────────────────────

router.route('/:tripId/budget')
  .get(travelPlanController.getBudgetAnalysis)
  .patch(travelPlanController.updateBudget);

// ─────────────────────────────────────────────────────────────────────────────
// CHECKLIST
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:tripId/checklist/urgent', travelPlanController.getUrgentChecklistItems);
router.post('/:tripId/checklist', travelPlanController.addChecklistItem);

router.route('/:tripId/checklist/:itemId')
  .patch(travelPlanController.updateChecklistItem)
  .delete(travelPlanController.deleteChecklistItem);

router.patch('/:tripId/checklist/:itemId/toggle', travelPlanController.toggleChecklistItem);

// ─────────────────────────────────────────────────────────────────────────────
// ITINERARY
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:tripId/itinerary/generate', travelPlanController.generateItineraryFromStops);
router.post('/:tripId/itinerary', travelPlanController.addItineraryDay);

router.route('/:tripId/itinerary/:dayId')
  .patch(travelPlanController.updateItineraryDay)
  .delete(travelPlanController.deleteItineraryDay);

// ─────────────────────────────────────────────────────────────────────────────
// FLIGHTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:tripId/flights/upcoming', travelPlanController.getUpcomingFlights);
router.post('/:tripId/flights', travelPlanController.addFlight);

router.route('/:tripId/flights/:flightId')
  .patch(travelPlanController.updateFlight)
  .delete(travelPlanController.deleteFlight);

// ─────────────────────────────────────────────────────────────────────────────
// ACCOMMODATIONS
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:tripId/accommodations', travelPlanController.addAccommodation);

router.route('/:tripId/accommodations/:accommodationId')
  .patch(travelPlanController.updateAccommodation)
  .delete(travelPlanController.deleteAccommodation);

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORT
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:tripId/transport', travelPlanController.addTransport);

// ─────────────────────────────────────────────────────────────────────────────
// PACKING LIST
// ─────────────────────────────────────────────────────────────────────────────

router.post('/:tripId/packing/init', travelPlanController.initializeDefaultPackingList);
router.post('/:tripId/packing', travelPlanController.addPackingItem);
router.patch('/:tripId/packing/:categoryId/items/:itemId/toggle', travelPlanController.togglePackingItem);

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:tripId/documents/expiring', travelPlanController.getExpiringDocuments);
router.post('/:tripId/documents', travelPlanController.addDocument);
router.patch('/:tripId/documents/:documentId/verify', travelPlanController.verifyDocument);

// ─────────────────────────────────────────────────────────────────────────────
// TRIP ACTIVATION & STATUS
// ─────────────────────────────────────────────────────────────────────────────

router.get('/:tripId/validate-activation', travelPlanController.validateTripReadyForActivation);
router.post('/:tripId/activate', travelPlanController.activateTrip);
router.post('/:tripId/complete', travelPlanController.completeTrip);

export default router;