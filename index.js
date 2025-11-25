const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 4000; // 3000 port ta use koro na takle cess.env.PORT

// middleware
app.use(express.json());
app.use(cors());

//mongodb
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
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const db = client.db("event_ctg");
    const eventColl = db.collection("events");

    app.get("/events", async (req, res) => {
      const result = await eventColl.find().toArray();
      res.send(result);
    });

    app.post("/event", async (req, res) => {
      const parcel = req.body;
      const result = await eventColl.insertOne(parcel);
      res.send(result);
    });

    app.post("/event/", async (req, res) => {
      const { id } = req.params;
      const objectid = new ObjectId(id);
      const result = await eventColl.findOne({ _id: objectid });
      res.send(result);
    });

    app.get("/events/:id", async (req, res) => {
      const { id } = req.params;
      const objectid = new ObjectId(id);
      const result = await eventColl.findOne({ _id: objectid });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //     await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("server is running!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
