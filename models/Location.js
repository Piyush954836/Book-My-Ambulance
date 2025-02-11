// models/Location.js

const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'User' }, // reference to User model (you can modify this to use driverId in a similar way)
    type: { type: String, enum: ['driver', 'user'], required: true },  // driver or user
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    updatedAt: { type: Date, default: Date.now },
});

const Location = mongoose.model('Location', locationSchema);
module.exports = Location;
