const mongoose = require("mongoose");

const hospitalSchema = new mongoose.Schema({
  name: { type: String, required: true },
  address: { type: String, required: true },
  contact: { type: String, required: true },
  responsiblePerson: { type: String, required: true },
  role: { type: String, enum: ["Operation Manager", "Trauma Center Head"], required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  location: { 
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true }
  },
  registeredAt: { type: Date, default: Date.now }
});

const Hospital = mongoose.model("Hospital", hospitalSchema);
module.exports = Hospital;
