/* eslint-disable no-console */
import server from "./_server";
import mongoose from "mongoose";
import dotenv from "dotenv";


dotenv.config();

const host = process.env.HOST || "localhost";
const port = process.env.PORT || 3001;

try {
    connectMongoDB(String(process.env.MONGO_URI));

    server.set("host", host);
    server.set("port", port);
    server.listen(server.get("port"), server.get("host"));
    console.log(`Server : listening on http://${host}:${port}`);
}
catch (error: any) {
    console.error(error.message);
}

async function connectMongoDB(uri: string) {
    mongoose.set("strictQuery", false);
    const db = await mongoose.connect(uri);
    console.log(`Server : successfully connected to MongoDB, Database name: "${db.connections[0].name}"`);
}