const express = require("express");
const multer = require('multer')
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const route = require("./src/routes/route");
const app = express();




app.use(multer().any())

mongoose.connect("mongodb+srv://ajitkerle:2R693j4kFokYqNZJ@cluster0.djs4ptj.mongodb.net/ajitkerle-product-management?retryWrites=true&w=majority",{
      useNewUrlParser:true
}
)
.then((rerult)=>console.log("MongoDB is connected"))
.catch((err)=>console.log(err.message));

app.use("/" ,route);
app.listen(process.env.PORT || 3000 ,()=>{console.log("server is start on port"+ (process.env.PORT || 3000))})
