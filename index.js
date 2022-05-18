const express = require('express');
const { MongoClient, ServerApiVersion, Admin } = require('mongodb');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const app = express()
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.gyudr.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {

    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'Unauthorized Access' })
    }

    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {

        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    });
}

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('doctors-portal').collection('services');
        const bookingCollection = client.db('doctors-portal').collection('booking');
        const userCollection = client.db('doctors-portal').collection('user');

        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = serviceCollection.find(query)
            const services = await cursor.toArray()
            res.send(services);

        })

        app.get('/available', async (req, res) => {
            const date = req.query.date;
            // step 1:  get all services
            const services = await serviceCollection.find().toArray()

            // step 2: get the booking of that day
            const query = { date: date };
            const booking = await bookingCollection.find(query).toArray()

            // step 3: for each service
            services.forEach(service => {
                // step 4: find bookings for that service. 
                const serviceBooking = booking.filter(book => book.treatment === service.name);

                // step 5: select slots for the service Bookings: 
                const bookedSlots = serviceBooking.map(book => book.slot)

                // step 6: select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot))

                //step 7: set available to slots to make it easier 
                service.slots = available;

            })
            res.send(services);

        })

        app.get('/booking', verifyJWT, async (req, res) => {
            const patient = req.query.patient;

            const decodedEmail = req.decoded.email;

            console.log(patient, decodedEmail)

            if (patient === decodedEmail) {
                const query = { patient: patient }
                const bookings = await bookingCollection.find(query).toArray()
                return res.send(bookings)

            } else {
                return res.status('403').send({ message: 'Forbidden Access' })
            }

        })

        app.get('/users', verifyJWT, async (req, res) => {
            const users = await userCollection.find().toArray();
            res.send(users);
        })

        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email;
            const user = await userCollection.findOne({ email: email });
            const isAdmin = user.role === 'admin';
            res.send({ admin: isAdmin });
        })


        app.put('/user/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const requester = req.decoded.email;
            const requesterAccount = await userCollection.findOne({ email: requester })
            if (requesterAccount.role === "admin") {
                const filter = { email: email };
                const updateDoc = {
                    $set: { role: 'admin' },
                };
                const result = await userCollection.updateOne(filter, updateDoc)
                res.send(result);
            } else {
                res.status(403).send({ message: 'Forbidden Access' })
            }


        })

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true }
            const updateDoc = {
                $set: user,
            };

            const result = await userCollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ result, token });


        })


        // insert a data to the data base
        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patient: booking.patient }
            const exist = await bookingCollection.findOne(query);

            if (exist) {
                return res.send({ success: false, booking: exist })
            }

            const result = await bookingCollection.insertOne(booking);
            res.send({ success: true, result });

        })

    }
    finally {
    }
}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('doctors portal is running')
})

app.listen(port, console.dir(`doctors portal is running form, ${port}`))