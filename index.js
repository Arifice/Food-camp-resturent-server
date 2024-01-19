const express = require('express');
const app=express();
const cors = require('cors');
const jwt=require('jsonwebtoken');
require('dotenv').config();

const stripe=require('stripe')(process.env.STRIPE_SECRET_KEY);
// console.log(process.env.STRIPE_SECRET_KEY);


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;


// middlewire

app.use(cors());
app.use(express.json());




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.meaty0s.mongodb.net/?retryWrites=true&w=majority`

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
     client.connect();

     const menuCollection=client.db('FoodCamp').collection('menu');
     const reviewCollection=client.db('FoodCamp').collection('review');
     const cartCollection=client.db('FoodCamp').collection('cart');
     const usersCollection=client.db('FoodCamp').collection('users');
     const paymentsCollection=client.db('FoodCamp').collection('payments');   



    // middile wire

    const verifyToken=(req,res,next)=>{
      // console.log('inside verify token :',req.headers?.authorization); 
    if(!req.headers?.authorization){
      return res.status(401).send({message:'Forbidden access'});
    }
    const token=req.headers?.authorization.split(' ')[1];
    // console.log('token',token);
    jwt.verify(token , process.env.ACCESS_TOKEN , (err,decoded)=>{
      if(err){
        return res.status(401).send({message:'Unathorized access'});
      }
      req.decoded=decoded;
      // console.log('from verify token',decoded);
      next();
    })            
  }

  // use verify admin after verifytoken
  const verifyAdmin=async(req,res,next)=>{
    const email=req.decoded.email;
    const query={email:email};      
    const user=await usersCollection.findOne(query);
    // console.log('decoded',email,'user email',user.email);
    const isAdmin=user?.role ==='admin';
    // console.log('isAdmin',isAdmin);
    if(!isAdmin){
      return res.status(403).send({message:'Forbidden Access'});
    }
    next();

  }


      //  jwt related api
     app.post('/jwt',async(req,res)=>{
      const user=req.body;
      const token=jwt.sign(user,process.env.ACCESS_TOKEN,{expiresIn:'1h'});
      res.send({token});
     })
      // menu collection
     app.get('/menu',async(req,res)=>{
        const result=await menuCollection.find().toArray();
        res.send(result);
     })
     app.get('/menu/:id',async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const result=await menuCollection.findOne(query);
      // console.log(result);
      res.send(result);
     })
     app.patch('/menu/:id',async(req,res)=>{
      const id=req.params.id;
      const user=req.body;
      const query={_id:new ObjectId(id)};      
      const updeteDoc={
        $set:{
                name:user.name,
                category:user.category,
                recipe:user.recipe,
                price:user.price,
                image:user.image,
        }
      }
      const result=await menuCollection.updateOne(query,updeteDoc);
      res.send(result);
     })

     app.post('/menu',verifyToken,verifyAdmin,async(req,res)=>{
      const item=req.body;
      const result=await menuCollection.insertOne(item);
      res.send(result);
     })
     app.delete('/menu/:id',verifyToken,verifyAdmin,async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const result =await menuCollection.deleteOne(query);
      res.send(result);
     })
     
      //  review colletion 
     app.get('/review',async(req,res)=>{        
        const result=await reviewCollection.find().toArray();
        res.send(result);
     })

    //  user collection
    app.post('/users',async(req,res)=>{
      const user=req.body;
      // insert if user doesn't exist
      const query={email:user.email};
      const existingUser=await usersCollection.findOne(query);
      if(existingUser){
        return res.send({message:'User already exist',insertedId:null});
      }
      const result=await usersCollection.insertOne(user);
      res.send(result);
    })
    
    


    app.get('/users',verifyToken, verifyAdmin, async(req,res)=>{           
      const result=await usersCollection.find().toArray();
      res.send(result);
    })
    app.get('/users/admin/:email',verifyToken,async(req,res)=>{
      const email=req.params.email;
      // console.log('user email:',email,'decoded : ',req.decoded.email);
      if(email !==req.decoded.email){
        return res.status(403).send({message:'Forbidden Access'});
      }
      const query={email:email};
      const user=await usersCollection.findOne(query);
      // console.log(user);
      let admin=false;
      if(user){
      admin=user?.role==='admin'
      }
      res.send({admin});
    })
    app.patch('/users/admin/:id',verifyToken,async(req,res)=>{
      const id=req.params.id;
      const filter={_id:new ObjectId(id)};
      const updateDoc={
        $set:{
          role:'admin',
        }
      }
      const result =await usersCollection.updateOne(filter,updateDoc);
      res.send(result);
    })
    app.delete('/users/:id',verifyToken,async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const result=await usersCollection.deleteOne(query);
      res.send(result);
    })
    // cart collection
    app.post('/cart',async(req,res)=>{
      const item=req.body;
      const result=await cartCollection.insertOne(item);
      res.send(result);
    }) 
    app.get('/cart',async(req,res)=>{ 
      const email=req.query.email;
      const query={email:email};     
      const result=await cartCollection.find(query).toArray();
      res.send(result);
    }) 
    app.delete('/cart/:id',async(req,res)=>{
      const id=req.params.id;
      const query={_id:new ObjectId(id)};
      const result=await cartCollection.deleteOne(query);
      res.send(result);
    })

    // Payment related Api
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      console.log({price});
      const amount=parseInt(price*100);
      console.log({amount});
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ['card'],        
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
      
    });

    app.post('/payments', async(req,res)=>{
      const payment=req.body;
      // console.log({payment});
      const query={_id:{
       $in: payment.cartIds.map(id=>new ObjectId(id)),
      }}
      const deleteResult=await cartCollection.deleteMany(query);
      const paymentResult=await paymentsCollection.insertOne(payment);      
      res.send({paymentResult,deleteResult});
    })
    app.get('/payments/:email', async(req,res)=>{
      const query ={email:req.params.email};
      // if(req.params.email !== req.decoded.email){
      //   return res.status(401).send({message:'Un Athorized access'});
      // }
      const result=await paymentsCollection.find(query).toArray();
      res.send(result);
    })
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);


app.get('/',(req,res)=>{
    res.send('Food Camp is running');
})
app.listen(port,()=>{
    console.log(`Food Camp is running on port ${port}`);
})