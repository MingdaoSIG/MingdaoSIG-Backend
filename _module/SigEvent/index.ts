import mongoose from "mongoose";

/**
 * SIG events (活動與社課, API contract v4 §3.3) and their RSVPs.
 *
 * - An event is "past" once its `endAt` has passed; until then (including
 *   while it runs) it is "upcoming".
 * - `capacity` 0 means unlimited.
 * - Removing an event is a soft delete; its RSVPs stay.
 *
 * Collections: `event` and `event-rsvp` (one document per user and event,
 * unique). Indexes are built at startup by @module/EnsureIndexes once a router
 * imports this module.
 */

export const EVENT_TITLE_MAX_LENGTH = 60;
export const EVENT_DESCRIPTION_MAX_LENGTH = 1000;
export const EVENT_LOCATION_MAX_LENGTH = 60;
export const EVENT_CAPACITY_MAX = 100000;

const eventSchema = new mongoose.Schema(
  {
    sig: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    location: { type: String, default: "" },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    capacity: { type: Number, default: 0 },
    rsvpOpen: { type: Boolean, default: true },
    createdBy: { type: String, required: true },
    removed: { type: Boolean, default: false },
  },
  { timestamps: true },
);

// GET /sig/:sigId/events (by startAt), the calendar feed and the analytics.
eventSchema.index({ sig: 1, removed: 1, startAt: 1 });

const eventRsvpSchema = new mongoose.Schema(
  {
    event: { type: String, required: true },
    user: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One RSVP per user and event; also serves the counts and the RSVP list.
eventRsvpSchema.index({ event: 1, user: 1 }, { unique: true });

export const EventModel =
  (mongoose.models.event as mongoose.Model<any>) ??
  mongoose.model("event", eventSchema, "event");

export const EventRsvpModel =
  (mongoose.models["event-rsvp"] as mongoose.Model<any>) ??
  mongoose.model("event-rsvp", eventRsvpSchema, "event-rsvp");

export type EventDoc = {
  _id: unknown;
  sig: string;
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  capacity: number;
  rsvpOpen: boolean;
  createdBy: string;
  removed: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type EventItem = {
  _id: string;
  sig: string;
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  capacity: number;
  rsvpOpen: boolean;
  rsvpCount: number;
  rsvpedByMe?: boolean;
};

export function isPast(event: Pick<EventDoc, "endAt">, now = new Date()) {
  return new Date(event.endAt).getTime() < now.getTime();
}

/** A non-removed event, or null. */
export async function readEvent(id: string) {
  if (!mongoose.isValidObjectId(id)) return null;
  return (await EventModel.findOne({
    _id: id,
    removed: false,
  }).lean()) as EventDoc | null;
}

/** Number of RSVPs of each event, keyed by event id. */
export async function rsvpCounts(eventIds: string[]) {
  const counts = new Map<string, number>();
  if (eventIds.length === 0) return counts;

  const groups: { _id: string; count: number }[] =
    await EventRsvpModel.aggregate([
      { $match: { event: { $in: eventIds } } },
      { $group: { _id: "$event", count: { $sum: 1 } } },
    ]);
  for (const group of groups) counts.set(String(group._id), group.count);
  return counts;
}

/**
 * The API item for each event, in the same order. `rsvpedByMe` is added only
 * when `viewerId` is given (the request carried a valid JWT).
 */
export async function toEventItems(
  events: EventDoc[],
  viewerId: string | null,
): Promise<EventItem[]> {
  const ids = events.map((event) => String(event._id));
  const [counts, mine] = await Promise.all([
    rsvpCounts(ids),
    viewerId && ids.length > 0
      ? EventRsvpModel.find(
          { event: { $in: ids }, user: viewerId },
          { event: 1 },
        ).lean()
      : Promise.resolve([] as { event: string }[]),
  ]);
  const rsvped = new Set(mine.map((rsvp: any) => String(rsvp.event)));

  return events.map((event) => {
    const id = String(event._id);
    const item: EventItem = {
      _id: id,
      sig: event.sig,
      title: event.title,
      description: event.description ?? "",
      location: event.location ?? "",
      startAt: event.startAt,
      endAt: event.endAt,
      capacity: event.capacity ?? 0,
      rsvpOpen: event.rsvpOpen !== false,
      rsvpCount: counts.get(id) ?? 0,
    };
    if (viewerId) item.rsvpedByMe = rsvped.has(id);
    return item;
  });
}
