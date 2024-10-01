const express = require("express");
const mongoose = require("mongoose");
require("dotenv").config();
const messageRoutes = require('../src/routes/messageRoute');

const app = express();
const port = process.env.PORT || 9000;

// Middleware
app.use(express.json());
app.use('/api/messages', messageRoutes);

// Rutas base
app.get("/", (res) => {
  res.send("Welcome to my API");
});

// Conexión con MongoDB Atlas
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch((error) => console.error(error));

// Iniciar servidor
app.listen(port, () => console.log("Server listening on port", port));
