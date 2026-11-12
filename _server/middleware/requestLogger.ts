import { IncomingMessage } from "node:http";
import morgan from "morgan";

// Join-request confirm ids work like passwords: anyone holding one can accept
// or reject the request, so keep them out of the access log.
const CONFIRM_ID_PATH = /(\/sig\/confirm\/)[^/?#]+/g;

morgan.token("url", (req: IncomingMessage & { originalUrl?: string }) =>
  (req.originalUrl || req.url || "").replace(CONFIRM_ID_PATH, "$1[redacted]"),
);

const requestLogger = morgan("combined");

export default requestLogger;
