const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 4000;

// middleware
app.use(express.json());
app.use(cors());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@simple-crud-server.tdeipi8.mongodb.net/?appName=simple-crud-server`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();

    const db = client.db("event_ctg");
    const eventColl = db.collection("events");

    app.get("/events", async (req, res) => {
      const email = req.query.email;
      const query = email ? { email } : {};
      const result = await eventColl.find(query).toArray();
      res.send(result);
    });

    app.get("/events/:id", async (req, res) => {
      const { id } = req.params;
      const objectid = new ObjectId(id);
      const result = await eventColl.findOne({ _id: objectid });
      res.send(result);
    });

    app.post("/events", async (req, res) => {
      const data = req.body;
      const result = await eventColl.insertOne(data);
      res.send(result);
    });

    await client.db("admin").command({ ping: 1 });
    console.log("Connected to MongoDB!");
  } finally {
    // don't close client
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running!");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
