var r = require("rethinkdb");
var express = require("express");
var app = require("express")();
var http = require("http").Server(app);
var io = require("socket.io")(http);
var cors = require('cors');
var bodyParser = require('body-parser');

app.use(cors())
// configure the app to use bodyParser()
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(bodyParser.json());

// Setup Database
r.connect({ host: "localhost", port: 28015 }, function(err, conn) {
  if (err) throw err;
  r
    .db("test")
    .tableList()
    .run(conn, function(err, response) {
      if (response.indexOf("edit") > -1) {
        // do nothing it is created...
        console.log("Table exists, skipping create...");
        console.log("Tables - " + response);
      } else {
        // create table...
        console.log("Table does not exist. Creating");
        r
          .db("test")
          .tableCreate("edit")
          .run(conn);
      }
    });

  // Socket Stuff
  io.on("connection", function(socket) {
    console.log("a user connected");
    socket.on("disconnect", function() {
      console.log("user disconnected");
    });
    socket.on("document-update", function(msg) {
      r
        .table("edit")
        .insert(
          { id: msg.id, value: msg.value, user: msg.user },
          { conflict: "update" }
        )
        .run(conn, function(err, res) {
          if (err) throw err;
        });
    });
    r
      .table("edit")
      .changes()
      .run(conn, function(err, cursor) {
        if (err) throw err;
        cursor.each(function(err, row) {
          if (err) throw err;
          io.emit("doc", row);
        });
      });
  });

  app.post("/getData/:id", async function(request, response, next) {
    let resultObj = null;
    r
      .table("edit")
      .get(request.params.id)
      .run(conn, function(err, result) {
        resultObj = result;
        if (err) throw err;
        if(resultObj === null){
          r
            .table("edit")
            .insert(
              request.body,
              { conflict: "update" }
            )
            .run(conn, function(err, res) {
              if (err) throw err;
              resultObj = request.body;
              response.send(resultObj);
            });
        }else{
          response.send(resultObj);
        }
      });
  });
});



// Serve HTML
app.get("/", function(req, res) {
  res.sendFile(__dirname + "/index.html");
});

app.use("/bower_components", express.static("bower_components"));

http.listen(5000, "0.0.0.0", function() {
    console.log("listening on: 0.0.0.0:5000");
  });