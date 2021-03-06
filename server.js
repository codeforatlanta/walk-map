var express = require('express')
var MongoClient = require('mongodb').MongoClient
var api = require('./api')
var fs = require('fs')
var path = require('path')
var browserify = require('browserify')

process.env = require('./load_env.js')

var url = process.env.MONGO_URL
var app = express()
var template = require('./template.js')
var radius = 5.0 / 3963.2 // 5 miles converted to radians (by dividing radius of earth)

// TODO: calculate area of parks - score is a product of park's polygon area

function getParkScore(db, lat, lng) {
  return db.collection('murals').find({
    location: {
      $geoWithin: { $centerSphere: [ [ lat, lng ], radius ] }
    }
  }).count().then(function (count) {
    // plus one point for every mural in the area
    return 1 * count
  })
}

function getCrimeScore(db, lat, lng) {
  return db.collection('crimes').find({
      location: {
        $geoWithin: { $centerSphere: [ [ lat, lng ], radius ] }
      }
    }).count().then(function (count) {
      // minus one point for every crime in the area
      return -1 * count
    })
}

app.get('/api/score', function (req, res) {
  // calculate scores for different endpoints
  var lat = parseInt(req.query.lat, 10)
  var lng = parseInt(req.query.lng, 10)
  if (!lat || !lng) {
    return res.status(400).json({
      error: "Missing required query parameters: lat, lng"
    })
  }
  Promise.all([
    getCrimeScore(app.db, lat, lng),
    getParkScore(app.db, lat, lng)
    // TODO add more endpoints
  ]).then(function (results) {
    return results.reduce(function (a, b) { return a + b }, 0)
  }).then(function (score) {
    res.json({ score: score })
  }).catch(function (err) {
    res.status(500).json(err)
  })
})

app.get('/', function (req, res) {
  template(res)
})

app.get('/bundle.js', function (req, res) {
  res.status(200)
  return app.b.bundle().pipe(res)
})

app.get('/favicon.ico', function (req, res) {
  return res.sendFile(require('fs').readFileSync(path.resolve('./favicon')))
})

app.b = browserify()

MongoClient.connect(url).then(function (db) {
  fs.readdirSync(path.resolve('./components'))
      .forEach(function(file) {
        app.b.add(path.resolve('./components/' + file))
      })
  app.db = db

  var port = process.env.PORT || 8080
  app.listen(port, function() {
    console.log('server listening on port ' + port)
  })
})