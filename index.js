const express = require("express");
const cors = require("cors");
const app = express();
require("dotenv").config();
const jwt = require("jsonwebtoken");
const SSLCommerzPayment = require("sslcommerz-lts");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized access" });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decode) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized access" });
    }
    req.decode = decode;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9a4nghi.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const store_id = process.env.STORE_ID;
const store_passwd = process.env.STORE_PASSWORD;
const is_live = false; //true for live, false for sandbox

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const sliderCollection = client.db("ElectronicStore").collection("slider");
    const featureCollection = client
      .db("ElectronicStore")
      .collection("featureProduct");
    const allProductsCollection = client
      .db("ElectronicStore")
      .collection("allProducts");
    const currentUserCollection = client
      .db("ElectronicStore")
      .collection("users");
    const ProductsCollection = client
      .db("ElectronicStore")
      .collection("products");
    const orderCollection = client.db("ElectronicStore").collection("orders");

    app.post("/jwt", (req, res) => {
      const email = req.body;
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decode.email;
      const query = { email: email };
      const user = await currentUserCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      next();
    };

    /* get all user for admin */
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await currentUserCollection.find().toArray();
      res.send(result);
    });

    /*all users Save to mongoDB  */
    app.put("/users/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email: email };
      const option = { upsert: true };
      const updatedDoc = {
        $set: user,
      };
      const result = await currentUserCollection.updateOne(
        query,
        updatedDoc,
        option
      );
      res.send(result);
    });

    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;
      if (req.decode.email !== email) {
        return res.send({ admin: false });
      }
      const query = { email: email };
      const user = await currentUserCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    /* Make Admin */
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await currentUserCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    /* Delete user by admin */
    app.delete("/users/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await currentUserCollection.deleteOne(query);
      res.send(result);
    });

    /* get slider */
    app.get("/slider", async (req, res) => {
      const result = await sliderCollection.find().toArray();
      res.send(result);
    });

    /* get feature product */
    app.get("/featureProduct", async (req, res) => {
      const result = await featureCollection.find().toArray();
      res.send(result);
    });

    /* get all products */
    app.get("/allProducts", async (req, res) => {
      const result = await allProductsCollection.find().toArray();
      res.send(result);
    });
    /* get all products for admin */
    app.get("/manageProducts", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await allProductsCollection.find().toArray();
      res.send(result);
    });

    app.delete("/manageProducts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allProductsCollection.deleteOne(query);
      res.send(result);
    });

    /* get single product */
    app.get("/singleProduct/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await allProductsCollection.findOne(query);
      res.send(result);
    });

    app.post("/allProducts", async (req, res) => {
      const product = req.body;
      const result = await allProductsCollection.insertOne(product);
      res.send(result);
    });

    /* bookmark product for user */
    app.post("/product", async (req, res) => {
      const product = req.body;
      const result = await ProductsCollection.insertOne(product);
      res.send(result);
    });

    /* get bookmark product for user */
    app.get("/product", verifyJWT, async (req, res) => {
      const email = req.query.userEmail;
      const decodeEmail = req.decode.email;
      if (email !== decodeEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = {
        userEmail: email,
      };
      if (!email) {
        return res.send([]);
      }
      const result = await ProductsCollection.find(query).toArray();
      res.send(result);
    });

    app.get("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ProductsCollection.findOne(query);
      res.send(result);
    });

    /*  delete product for user */
    app.delete("/product/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await ProductsCollection.deleteOne(query);
      res.send(result);
    });

    app.get("/order", async (req, res) => {
      const email = req.query.userEmail;
      const query = {userEmail: email};
      const result = await orderCollection.find(query).toArray();
      res.send(result)
    });

    const transition_id = new ObjectId().toString();
    app.post("/order",async (req, res) => {
      const product = await ProductsCollection.findOne({
        _id: new ObjectId(req.body.paymentProductId),
      });
      const order = req.body;
      const data = {
        total_amount: product?.price,
        currency: order.currency,
        tran_id: transition_id, // use unique tran_id for each api call
        success_url: `https://electronic-store-server.vercel.app/payment/success/${transition_id}`,
        fail_url: "http://localhost:3030/fail",
        cancel_url: "http://localhost:3030/cancel",
        ipn_url: "http://localhost:3030/ipn",
        shipping_method: "Courier",
        product_name: order.productName,
        product_category: order.category,
        product_profile: "general",
        cus_name: order.name,
        cus_email: order.userEmail,
        cus_add1: order.address,
        cus_add2: "Dhaka",
        cus_city: "Dhaka",
        cus_state: "Dhaka",
        cus_postcode: order.postCode,
        cus_country: "Bangladesh",
        cus_phone: order.number,
        cus_fax: "01711111111",
        ship_name: "Customer Name",
        ship_add1: "Dhaka",
        ship_add2: "Dhaka",
        ship_city: "Dhaka",
        ship_state: "Dhaka",
        ship_postcode: 1000,
        ship_country: "Bangladesh",
      };
  
      const sslcz = new SSLCommerzPayment(store_id, store_passwd, is_live);
      sslcz.init(data).then((apiResponse) => {
        // Redirect the user to payment gateway
   
        let GatewayPageURL = apiResponse.GatewayPageURL;
        res.send({ url: GatewayPageURL });
       
        const finalOrder = {
          ...product,
          paidStatus: false,
          transitionId: transition_id,
        };
        const result = orderCollection.insertOne(finalOrder);
      });

      app.post("/payment/success/:tranId", async (req, res) => {
  
        const result = await orderCollection.updateOne(
          { transitionId: req.params.tranId },
          {
            $set: {
              paidStatus: true,
            },
          }
        );
        if (result.modifiedCount > 0) {
          res.redirect(`https://electronic-store-auth.web.app/dashboard/paymentHistory`);
        }
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Electronic store is running");
});

app.listen(port, () => {
  console.log(`Electronic store is running on port :  ${port}`);
});
