// routes/bookingRoutes.js
const express = require("express");
const router = express.Router();
const Booking = require("../models/Booking");

module.exports = (io) => {
  // POST /book/book-ambulance
  router.post("/book-ambulance", async (req, res) => {
    try {
      const { driverId, patientName, patientMobile, latitude, longitude } = req.body;

      // Validate required fields
      if (!driverId || !patientName || !patientMobile || !latitude || !longitude) {
        return res.status(400).json({ success: false, message: "Missing required fields" });
      }

      // Create a new booking with status "pending"
      const newBooking = new Booking({
        driverId,
        patientName,
        patientMobile,
        latitude,
        longitude,
        status: "pending"
      });

      await newBooking.save();

      // Emit event to the specific driver's room so that the driver receives the booking request
      console.log("Emitting newBookingRequest to driverId:", driverId);
      io.to(driverId).emit("newBookingRequest", {
        bookingId: newBooking._id,
        patientName,
        patientMobile,
        latitude,
        longitude
      });

      return res.json({ success: true, message: "Booking request sent to driver." });
    } catch (error) {
      console.error("Error booking ambulance:", error);
      return res.status(500).json({ success: false, message: "Server error" });
    }
  });

  return router;
};
