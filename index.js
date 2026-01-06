// index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
app.use(express.json());
app.use(cors());

// Env
const PORT = process.env.PORT || 4000;
const MONGO_USER = process.env.DB_USER;
const MONGO_PASS = process.env.DB_PASS;
const MONGO_DBNAME = process.env.DB_NAME || "event_ctg";

// Validate env quickly
if (!MONGO_USER || !MONGO_PASS) {
  console.error("Missing DB_USER or DB_PASS in environment.");
  process.exit(1);
}

// Mongo URI (use retryWrites and majority writeConcern)
const uri = `mongodb+srv://${encodeURIComponent(
  MONGO_USER
)}:${encodeURIComponent(
  MONGO_PASS
)}@simple-crud-server.tdeipi8.mongodb.net/${MONGO_DBNAME}?retryWrites=true&w=majority`;

// Global client / reuse pattern
let client;
let eventColl;
let userColl;

async function getDbCollection() {
  if (!client) {
    client = new MongoClient(uri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
      },
    });
    await client.connect();
    console.log("MongoDB connected");
    const db = client.db(MONGO_DBNAME);
    eventColl = db.collection("events");
    userColl = db.collection("users");
  }
  return eventColl;
}

async function getUserCollection() {
  if (!client) {
    await getDbCollection();
  }
  return userColl;
}

// Health check (useful for Render)
app.get("/healthz", async (req, res) => {
  try {
    const col = await getDbCollection();
    // quick ping
    await client.db().command({ ping: 1 });
    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Health check failed:", err);
    return res.status(500).json({ status: "error", message: err.message });
  }
});

// Routes
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// GET all events, optional filter by email
app.get("/events", async (req, res) => {
  try {
    const col = await getDbCollection();
    const email = req.query.email;
    const query = email ? { email } : {};
    const result = await col.find(query).toArray();
    res.json(result);
  } catch (err) {
    console.error("GET /events error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET latest events (sorted by start_date or createdAt)
app.get("/latest-events", async (req, res) => {
  try {
    const col = await getDbCollection();
    // choose a field to sort by (start_date or createdAt)
    const result = await col.find().sort({ start_date: -1 }).limit(6).toArray();
    res.json(result);
  } catch (err) {
    console.error("GET /latest-events error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET single event by id
app.get("/events/:id", async (req, res) => {
  try {
    const col = await getDbCollection();
    const id = req.params.id;
    const objId = new ObjectId(id);
    const doc = await col.findOne({ _id: objId });
    if (!doc) return res.status(404).json({ message: "Event not found" });
    res.json(doc);
  } catch (err) {
    console.error("GET /events/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE event
app.post("/events", async (req, res) => {
  try {
    const col = await getDbCollection();
    const data = req.body;
    // Optional: add createdAt if not present
    if (!data.createdAt) data.createdAt = new Date();
    const result = await col.insertOne(data);
    res.status(201).json(result);
  } catch (err) {
    console.error("POST /events error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE event
app.delete("/events/:id", async (req, res) => {
  try {
    const col = await getDbCollection();
    const id = req.params.id;
    const result = await col.deleteOne({ _id: new ObjectId(id) });
    res.json(result);
  } catch (err) {
    console.error("DELETE /events/:id error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== USER ROUTES ====================

// GET user by email (check if user exists and get role)
app.get("/users/:email", async (req, res) => {
  try {
    const col = await getUserCollection();
    const email = req.params.email;
    const user = await col.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found", exists: false });
    }
    res.json({ ...user, exists: true });
  } catch (err) {
    console.error("GET /users/:email error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET all users (admin only)
app.get("/users", async (req, res) => {
  try {
    const col = await getUserCollection();
    const users = await col.find().toArray();
    res.json(users);
  } catch (err) {
    console.error("GET /users error:", err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE or UPDATE user (upsert)
app.put("/users/:email", async (req, res) => {
  try {
    const col = await getUserCollection();
    const email = req.params.email;
    const userData = req.body;

    // Check if user exists
    const existingUser = await col.findOne({ email });

    if (existingUser) {
      // Update existing user (but don't change role unless admin)
      const updateData = {
        name: userData.name || existingUser.name,
        photoURL: userData.photoURL || existingUser.photoURL,
        lastLogin: new Date(),
      };

      // Only update role if explicitly provided and user is admin
      if (userData.role && userData.isAdminRequest) {
        updateData.role = userData.role;
      }

      const result = await col.updateOne({ email }, { $set: updateData });
      const updatedUser = await col.findOne({ email });
      res.json(updatedUser);
    } else {
      // Create new user with default role "user"
      const newUser = {
        email,
        name: userData.name || "",
        photoURL: userData.photoURL || "",
        role: userData.role || "user", // default role
        status: "active",
        createdAt: new Date(),
        lastLogin: new Date(),
      };
      await col.insertOne(newUser);
      res.status(201).json(newUser);
    }
  } catch (err) {
    console.error("PUT /users/:email error:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE user role (admin only)
app.patch("/users/:email/role", async (req, res) => {
  try {
    const col = await getUserCollection();
    const email = req.params.email;
    const { role } = req.body;

    if (!["user", "organizer", "admin"].includes(role)) {
      return res
        .status(400)
        .json({ error: "Invalid role. Must be user, organizer, or admin" });
    }

    const result = await col.updateOne(
      { email },
      { $set: { role, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = await col.findOne({ email });
    res.json(updatedUser);
  } catch (err) {
    console.error("PATCH /users/:email/role error:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE user status (admin only - suspend/activate)
app.patch("/users/:email/status", async (req, res) => {
  try {
    const col = await getUserCollection();
    const email = req.params.email;
    const { status } = req.body;

    if (!["active", "suspended"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Invalid status. Must be active or suspended" });
    }

    const result = await col.updateOne(
      { email },
      { $set: { status, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = await col.findOne({ email });
    res.json(updatedUser);
  } catch (err) {
    console.error("PATCH /users/:email/status error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE user (admin only)
app.delete("/users/:email", async (req, res) => {
  try {
    const col = await getUserCollection();
    const email = req.params.email;
    const result = await col.deleteOne({ email });
    res.json(result);
  } catch (err) {
    console.error("DELETE /users/:email error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Check if user is admin
app.get("/users/check/admin/:email", async (req, res) => {
  try {
    const col = await getUserCollection();
    const email = req.params.email;
    const user = await col.findOne({ email });
    res.json({ isAdmin: user?.role === "admin" });
  } catch (err) {
    console.error("GET /users/check/admin error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Check if user is organizer
app.get("/users/check/organizer/:email", async (req, res) => {
  try {
    const col = await getUserCollection();
    const email = req.params.email;
    const user = await col.findOne({ email });
    res.json({
      isOrganizer: user?.role === "organizer" || user?.role === "admin",
    });
  } catch (err) {
    console.error("GET /users/check/organizer error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== END USER ROUTES ====================

// Graceful shutdown
async function shutdown(signal) {
  console.log(`Received ${signal}. Closing server...`);
  try {
    if (client) await client.close();
    process.exit(0);
  } catch (err) {
    console.error("Error during shutdown:", err);
    process.exit(1);
  }
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
