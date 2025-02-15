// models/Booking.js

const mongoose = require('mongoose');

// Define the Booking schema
const bookingSchema = new mongoose.Schema({
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', required: true },
    patientName: { type: String, required: true },
    patientMobile: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    status: { type: String, default: 'pending' }, // Status can be 'pending', 'confirmed', etc.
    bookingTime: { type: Date, default: Date.now }, // Time when booking was created
    confirmationTime: { type: Date },  // Time when driver confirms the booking
    notes: { type: String },  // Any additional notes (optional)
    createdAt: { type: Date, default: Date.now }
});

// Create and export the Booking model
const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
