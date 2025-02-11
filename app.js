const express = require('express');
const http = require("http");
const app = express();
const path = require('path');
const userRoutes = require('./routes/userRoutes');
const driverRoutes = require('./routes/driverRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const locationRoutes = require('./routes/locationRoutes'); 
const Driver = require('./models/Driver');
const Doctor = require('./models/Doctor');
const User = require('./models/User');
const Appointment = require('./models/Appointment');
const Booking = require('./models/Booking');
const session = require('express-session');
const socketIo = require("socket.io");
const flash = require('connect-flash');
const appointmentRoutes = require("./routes/appointmentRoutes");
const cron = require("node-cron");
const mongoose = require("mongoose");
require('dotenv').config();

const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*" } });

// Main database connection
const { connectDB } = require('./utils/mainDB'); 
connectDB(process.env.MONGODB_URI); 

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.set('view engine', 'ejs');

app.use(session({
    secret: 'JWT_SECRET',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false, // Use false in development (set to true in production for HTTPS)
        // Cookie expiration time (1 day)
    }
}));

app.use(flash());

app.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});
// Routes to render different pages
app.get('/', (req, res) => {
    res.render('index', { user: req.session.user });
});

// WebSocket for Real-Time Updates
io.on("connection", (socket) => {
    socket.on("updateAppointment", async ({ appointmentId, status }) => {
        await Appointment.findByIdAndUpdate(appointmentId, { status });

        // Notify all users
        io.emit("appointmentUpdated", { appointmentId, status });
    });
});

io.on('connection', (socket) => {
    console.log('Driver connected:', socket.id);

    socket.on('driverStatusChange', (data) => {
        io.emit('updateDriverStatus', data); // Broadcast to all users
    });

    socket.on('disconnect', () => {
        console.log('Driver disconnected:', socket.id);
    });
});

app.get('/driver-dashboard', async (req, res) => {
    try {
        // Retrieve the driver's ID from the session
        const driverId = req.session.driverId;
        if (!driverId) {
            return res.redirect('/driver-login'); // Redirect if not logged in
        }

        // Fetch the full driver object from the database
        const driver = await Driver.findById(driverId);
        if (!driver) {
            return res.status(404).send('Driver not found');
        }

        // Pass the driver object to the view
        res.render('driver-dashboard', { driver });
    } catch (error) {
        console.error(error);
        res.status(500).send('Error loading driver dashboard');
    }
});

app.get("/set-location", (req, res) => {
    const { latitude, longitude } = req.query;
    if (latitude && longitude) {
        req.session.userLocation = { latitude: parseFloat(latitude), longitude: parseFloat(longitude) };
        res.send("Location updated");
    } else {
        res.status(400).send("Invalid coordinates");
    }
});

app.post('/book-ambulance', async (req, res) => {
    try {
        const { driverId, patientName, patientMobile, latitude, longitude } = req.body;

        if (!driverId || !patientName || !patientMobile || !latitude || !longitude) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        // Create a new booking
        const newBooking = new Booking({
            driverId,
            patientName,
            patientMobile,
            userLatitude: latitude,
            userLongitude: longitude,
            status: 'pending',
        });

        await newBooking.save();

        // Get the driver's information (including location)
        const driver = await Driver.findById(driverId);

        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }

        // Send response with booking confirmation and driver info
        res.status(200).json({
            success: true,
            message: 'Ambulance booked successfully!',
            booking: newBooking,
            driver: {
                name: driver.name,
                latitude: driver.latitude,
                longitude: driver.longitude,
            },
            userLocation: {
                latitude,
                longitude,
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Failed to book ambulance. Please try again.' });
    }
});

app.get("/user-map", async (req, res) => {
    const { driverId, userId } = req.query;
    console.log(driverId);
    console.log(userId);

    if (!driverId || !userId) {
        return res.status(400).send("Driver ID and User ID are required.");
    }

    res.render("user-map", { driverId, userId });
});

// app.js
app.post('/update-driver-location', async (req, res) => {
    const { driverId, latitude, longitude } = req.body;

    try {
        const driver = await Driver.findById(driverId);
        if (!driver) {
            return res.status(404).json({ success: false, message: 'Driver not found' });
        }

        // Update the driver's location in the database
        driver.latitude = latitude;
        driver.longitude = longitude;
        await driver.save();

        res.status(200).json({ success: true, message: 'Driver location updated' });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Failed to update driver location' });
    }
});

app.get("/get-locations", async (req, res) => {
    const { driverId, userId } = req.query;

    if (!driverId || !userId) {
        return res.status(400).json({ error: "Driver ID and User ID are required." });
    }

    const driver = await Driver.findById(driverId);
    const booking = await Booking.findOne({ userId }).sort({ createdAt: -1 });

    if (!driver || !booking) {
        return res.status(404).json({ error: "Driver or User location not found." });
    }

    res.json({
        driver: { lat: driver.latitude, lng: driver.longitude },
        user: { lat: booking.userLat, lng: booking.userLng }
    });
});

// Emergency Button Route
app.get('/emergency', (req, res) => {
    if (!req.session.userLocation) {
        return res.send("User location is not set. Please allow location access.");
    }
    res.redirect('/driver/emergency');
});


// Doctor Dashboard Route
app.get('/doctor-dashboard', async (req, res) => {
    const doctorId = req.session.doctorId;
    if (!doctorId) {
        return res.redirect('/doctor-login'); // Redirect to login if not authenticated
    }

    const doctor = await Doctor.findById(doctorId);

    if (!doctor) {
        return res.status(404).send('Doctor not found');
    }

    res.render('doctor-dashboard', {doctor}); // Render the doctor dashboard
});

app.get('/emergency-map', (req, res) => {
    res.render('emergency-map'); // assuming emergency-map.ejs is the map page
});

app.get('/department', (req, res) => {
    res.render('department');
});

app.post('/about', (req, res) => {
    res.render('about');
});

app.post('/safety', (req, res) => {
    res.render('safety');
});

app.get('/about', (req, res) => {
    res.render('about', {user: req.session.user});
});

app.get('/safety', (req, res) => {
    res.render('safety', {user: req.session.user});
});


app.get('/user-login', (req, res) => {
    res.render('user-login');
});

app.get('/driver-login', (req, res) => {
    res.render('driver-login');
});

app.get('/doctor-login', (req, res) => {
    res.render('doctor-login');
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Failed to destroy session:', err);
            return res.redirect('/');
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        res.redirect('/'); // Redirect to the login page
    });
});

app.post("/set-location", (req, res) => {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).send("Latitude and longitude are required");
    }

    req.session.userLocation = { latitude, longitude };

    res.send("Location updated successfully");
});

app.post("/driver/update-location", async (req, res) => {
    const { driverId, latitude, longitude } = req.body;

    if (!driverId || !latitude || !longitude) {
        return res.status(400).send("All fields are required");
    }

    try {
        await Driver.findByIdAndUpdate(driverId, {
            location: { latitude, longitude }
        });
        res.send("Location updated");
    } catch (error) {
        console.error("Error updating driver location:", error);
        res.status(500).send("Server error");
    }
});


function getDistance(lat1, lon1, lat2, lon2) {
    
    const toRad = (value) => (value * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;

    return distance;
}

// Keep this route below the emergency one
app.get("/driver/emergency", async (req, res) => {
    try {
        console.log("Emergency route accessed");

        if (!req.session.userLocation) {
            console.log("User location not found in session");
            return res.status(400).send("User location not found");
        }

        const { latitude, longitude } = req.session.userLocation;

        let drivers = await Driver.find({ isActive: true, location: { $ne: null } });

        drivers = drivers.map(driver => {
            if (driver.location) {
                const distance = getDistance(latitude, longitude, driver.location.latitude, driver.location.longitude);
                return { ...driver.toObject(), distance };
            }
            return null;
        }).filter(driver => driver !== null);

        // Sort drivers based on distance
        drivers.sort((a, b) => a.distance - b.distance);

        
        res.render("emergency", { drivers });

    } catch (error) {
        console.error("Error in emergency route:", error);
        res.status(500).send("Server error");
    }
});

app.get("/driver/emergency-data", async (req, res) => {
    try {
        if (!req.session.userLocation) {
            return res.status(400).json({ error: "User location not found" });
        }

        const { latitude, longitude } = req.session.userLocation;
        let drivers = await Driver.find({ isActive: true, location: { $ne: null } });

        drivers = drivers.map(driver => {
            if (driver.location) {
                const distance = getDistance(latitude, longitude, driver.location.latitude, driver.location.longitude);
                return { ...driver.toObject(), distance };
            }
            return null;
        }).filter(driver => driver !== null);

        drivers.sort((a, b) => a.distance - b.distance);

        res.json(drivers);
    } catch (error) {
        console.error("Error in emergency-data route:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ Make sure this is BELOW "/driver/emergency"

app.get("/driver/:id", async (req, res) => {
    try {
        console.log("Received ID:", req.params.id);

        const driverId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(driverId)) {
            console.log("Invalid ObjectId:", driverId);
            return res.status(400).send("Invalid driver ID");
        }

        const driver = await Driver.findById(driverId);
        if (!driver) return res.status(404).send("Driver not found");

        res.render("available-driver", { drivers: driver });
    } catch (error) {
        console.error(error);
        res.status(500).send("Internal Server Error");
    }
});



app.get('/drivers', async (req, res) => {
    try {
        const drivers = await Driver.find();
        if (!drivers || drivers.length === 0) {
            return res.status(404).send('No drivers found');
        }

        // Render the template with all driver data
        res.render('available-driver', { drivers });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

app.get('/doctor-profile/:id/profile-picture', async (req, res) => {
    try {
        const doctor = await Doctor.findById(req.params.id);
        if (!doctor || !doctor.profilePicture || !doctor.profilePicture.data) {
            return res.redirect('/default-avatar.png'); // Default image
        }

        res.set('Content-Type', doctor.profilePicture.contentType);
        res.send(doctor.profilePicture.data);
    } catch (error) {
        console.error("Error retrieving profile picture:", error);
        res.status(500).send('Error retrieving profile picture');
    }
});

app.get('/doctor', async (req, res) => {
    try {
        console.log("Session UserID:", req.session.userId);
        const department = req.query.department; // Get the department from the query parameter
        const doctors = await Doctor.find({ department }); // Find doctors by department

        if (!doctors || doctors.length === 0) {
            return res.status(404).send('No doctors found for this department');
        }
        let user = null;
        if (req.session.userId) {
            user = await User.findById(req.session.userId);
        }

        res.render('available-doctor', { user, doctors, department }); // Pass doctors and department to the template
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});

// Get all doctors
app.get('/doctors', async (req, res) => {
    try {
        console.log("Session UserID:", req.session.userId); // Debugging

        const department = req.query.department;
        let doctors;

        if (department) {
            doctors = await Doctor.find({ department });
        } else {
            doctors = await Doctor.find();
        }

        if (!doctors || doctors.length === 0) {
            return res.status(404).send('No doctors found');
        }

        // Fetch user details from database using userId stored in session
        let user = null;
        if (req.session.userId) {
            user = await User.findById(req.session.userId);
        }

        res.render('available-doctor', { user, doctors, department }); // Pass user, doctors, and department
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal Server Error');
    }
});


app.get("/api/appointments", async (req, res) => {
    try {
        const doctorId = req.session.doctorId;  // Assuming doctorId is stored in session

        // Check if doctor is logged in
        if (!doctorId) {
            return res.status(401).json({ success: false, message: "Doctor is not logged in." });
        }

        const appointments = await Appointment.find({ doctorId });

        // If no appointments are found, return an empty array or a message
        if (appointments.length === 0) {
            return res.status(200).json({ success: true, message: "No appointments found." });
        }

        res.json(appointments);
    } catch (error) {
        console.error("Error fetching appointments:", error);
        res.status(500).json({ success: false, message: "Failed to fetch appointments." });
    }
});

app.post("/api/update-appointment/:id", async (req, res) => {
    try {
        const { status } = req.body;
        const appointmentId = req.params.id;

        const updatedAppointment = await Appointment.findByIdAndUpdate(
            appointmentId,
            { status },
            { new: true } // Returns the updated document
        );

        if (!updatedAppointment) {
            return res.status(404).json({ success: false, message: "Appointment not found" });
        }

        res.json({ success: true, appointment: updatedAppointment });
    } catch (error) {
        console.error("Error updating appointment:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
});



app.get("/api/doctors/:doctorId/available-slots", async (req, res) => {
    const { doctorId } = req.params;
    const allSlots = ["10:00 AM", "11:30 AM", "2:00 PM", "3:45 PM"];

    try {
        const now = new Date();
        
        console.log("Fetching available slots for Doctor ID:", doctorId);

        // Find booked appointments within the last 24 hours
        const bookedAppointments = await Appointment.find({ 
            doctorId, 
            createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) }  // Last 24 hours
        });

        console.log("Booked Appointments:", bookedAppointments);

        // Extract booked slot times
        const bookedSlots = bookedAppointments.map(appointment => appointment.time);

        console.log("Booked Slots:", bookedSlots);

        // Get available slots
        const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));

        console.log("Available Slots:", availableSlots);

        res.json(availableSlots);
    } catch (error) {
        console.error("Error fetching slots:", error);
        res.status(500).json({ error: "Server error" });
    }
});

// Run cleanup every hour
// Schedule a job to run every 2 minutes (for testing)

cron.schedule("0 0 * * *", async () => {
    try {
        const now = new Date();
        
        // Delete appointments older than today
        const result = await Appointment.deleteMany({
            date: { $lt: now.toISOString().split('T')[0] } // Only past dates
        });

        console.log(`${result.deletedCount} old appointments deleted.`);
    } catch (error) {
        console.error("Error deleting old appointments:", error);
    }
});


// Assuming you have an API to book an appointment
app.post('/api/book', async (req, res) => {
    const { doctorId, patientName, contact, age, date, time } = req.body;

    // Get patientId from the session
    const patientId = req.session.userId;  // Access userId from the session

    // Ensure patientId is a valid ObjectId
    const patientObjectId = new mongoose.Types.ObjectId(patientId);
 // Convert string to ObjectId

    // Check if all required fields are provided
    if (!doctorId || !patientId || !patientName || !contact || !age || !date || !time) {
        return res.status(400).json({ success: false, message: "All fields are required." });
    }

    try {
        const appointment = new Appointment({
            doctorId,
            patientId: patientObjectId,  // Use the converted patientId
            patientName,
            contact,
            age,
            date,
            time
        });

        // Save the appointment to the database
        await appointment.save();
        res.json({ success: true, message: "Appointment booked successfully!" });
    } catch (error) {
        console.error("Error booking appointment:", error);
        res.status(500).json({ success: false, message: "Failed to book appointment." });
    }
});
// Use routes for user, driver, and doctor
app.use('/user', userRoutes);
app.use('/driver', driverRoutes);
app.use('/doctor', doctorRoutes);
app.use("/api", appointmentRoutes);
app.use('/location', locationRoutes);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
