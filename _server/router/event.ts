import { Router } from "express";

import JWTverifier from "@middleware/JWTverifier";
import { rateLimiter, RateLimiterOption } from "@middleware/rateLimiter";
import {
  cancelRsvp,
  editEvent,
  eventCalendar,
  listRsvps,
  readEventById,
  removeEvent,
  rsvp,
} from "@controller/cloud/event";

// SIG events (API contract v4 §3.3). The SIG-scoped routes (list, create,
// calendar feed) are in the sig router.
const event: Router = Router();

event.use(rateLimiter(RateLimiterOption.BY_METHOD));
// Before "/:id", which would take "<id>.ics" as the id.
event.get("/:id.ics", eventCalendar);
event.get("/:id", readEventById);

event.use(JWTverifier);
event.get("/:id/rsvps", listRsvps);
event.post("/:id/rsvp", rsvp);
event.delete("/:id/rsvp", cancelRsvp);
event.post("/:id", editEvent);
event.delete("/:id", removeEvent);

export default event;
