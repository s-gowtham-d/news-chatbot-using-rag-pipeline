/**
 * This is only for starting the Express server.
 * The main server with Socket.IO has been moved to src/server.js 
 */

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import chatRoutes from "./routes/chat.js";

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use("/api", chatRoutes);

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
