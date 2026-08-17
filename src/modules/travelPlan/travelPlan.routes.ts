import { NextFunction, Request, Response, Router } from 'express';
import { travelPlanController } from './travelPlan.controller';
import { loadTrip, requireEditor, requireMember } from '../trips/trip.middleware';

const router = Router({ mergeParams: true });

// Mounted at /api/v1/trips/:tripId/plan. Never trust the path alone.
router.use(loadTrip(), requireMember);
const requirePlanEditor = (req: Request, res: Response, next: NextFunction) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  return requireEditor(req, res, next);
};
router.use(requirePlanEditor);

router.route('/').get(travelPlanController.getPlan).patch(travelPlanController.updatePlan);
router.patch('/section/:section', travelPlanController.updatePlanSection);
router.route('/budget').get(travelPlanController.getBudgetAnalysis).patch(travelPlanController.updateBudget);
router.get('/progress', travelPlanController.getPlanningProgress);
router.get('/summary', travelPlanController.getTripSummary);
router.get('/checklist/urgent', travelPlanController.getUrgentChecklistItems);
router.post('/checklist', travelPlanController.addChecklistItem);
router.route('/checklist/:itemId').patch(travelPlanController.updateChecklistItem).delete(travelPlanController.deleteChecklistItem);
router.patch('/checklist/:itemId/toggle', travelPlanController.toggleChecklistItem);
router.post('/itinerary/generate', travelPlanController.generateItineraryFromStops);
router.post('/itinerary', travelPlanController.addItineraryDay);
router.route('/itinerary/:dayId').patch(travelPlanController.updateItineraryDay).delete(travelPlanController.deleteItineraryDay);
router.get('/flights/upcoming', travelPlanController.getUpcomingFlights);
router.post('/flights', travelPlanController.addFlight);
router.route('/flights/:flightId').patch(travelPlanController.updateFlight).delete(travelPlanController.deleteFlight);
router.post('/accommodations', travelPlanController.addAccommodation);
router.route('/accommodations/:accommodationId').patch(travelPlanController.updateAccommodation).delete(travelPlanController.deleteAccommodation);
router.post('/transport', travelPlanController.addTransport);
router.delete('/transport/:transportId', travelPlanController.deleteTransport);
router.post('/packing/init', travelPlanController.initializeDefaultPackingList);
router.post('/packing', travelPlanController.addPackingItem);
router.patch('/packing/:categoryId/items/:itemId/toggle', travelPlanController.togglePackingItem);
router.delete('/packing/:categoryId/items/:itemId', travelPlanController.deletePackingItem);
router.get('/documents/expiring', travelPlanController.getExpiringDocuments);
router.post('/documents', travelPlanController.addDocument);
router.patch('/documents/:documentId/verify', travelPlanController.verifyDocument);
router.get('/contacts', travelPlanController.getContacts);
router.post('/contacts', travelPlanController.addContact);
router.patch('/contacts/:contactId', travelPlanController.updateContact);
router.delete('/contacts/:contactId', travelPlanController.deleteContact);
router.patch('/contacts/:contactId/primary', travelPlanController.setPrimaryContact);
router.get('/validate-activation', travelPlanController.validateTripReadyForActivation);
router.post('/activate', travelPlanController.activateTrip);
router.post('/complete', travelPlanController.completeTrip);

export default router;
