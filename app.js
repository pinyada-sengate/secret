require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.set("view engine", "ejs");

app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(express.static("public"));

app.use(
  session({
    secret: "Our liltle secret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

// CHANGE: USE "createStrategy" INSTEAD OF "authenticate"
passport.use(User.createStrategy());

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  User.findById(id, (err, user) => {
    done(err, user);
  });
});

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
    },
    (accessToken, refreshToken, profile, cb) => {
      console.log(profile);
      User.findOrCreate({ googleId: profile.id }, (err, user) => {
        console.log(err);
        console.log(user);
        return cb(err, user);
      });
    }
  )
);

app.get("/", (req, res) => {
  res.render("home");
});

app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    // Successful authentication
    res.redirect("/secrets");
  }
);

app.get("/register", (req, res) => {
  res.render("register");
});

app.get("/secrets", (req, res) => {
//   if (req.isAuthenticated()) {
//     res.render("secrets");
//   } else {
//     res.redirect("/login");
//   }

    User.find({"secret": {$ne:null}}, (err, users) => {
        if (!err) {
            if (users) {
                res.render("secrets", {usersWithSecrets: users});
            }
        } else {
            console.log(err);
        }
    });
});

app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});

app.post("/submit", (req, res) => {
    const submitedSecret = req.body.secret;
    console.log(req.user);

    User.findById({ _id: req.user._id }, (err, user) => {
        if (!err) {
            if (user) {
                user.secret = submitedSecret;
                user.save((err) => {
                    if (!err) {
                        res.redirect("/secrets");
                    } else {
                        console.log(err);
                    }
                });
            } else {
                console.log("User not found.");
            }
        } else {
            console.log(err);
        }
    });
});

app.post("/register", (req, res) => {
  //   bcrypt.hash(req.body.password, saltRounds, (err, hash) => {
  //     const user = new User({
  //       email: req.body.username,
  //       password: hash,
  //     });

  //     user.save((err) => {
  //       if (!err) {
  //         res.render("secrets");
  //       } else {
  //         console.log(err);
  //       }
  //     });
  //   });

  User.register(
    { username: req.body.username },
    req.body.password,
    (err, user) => {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, () => {
          res.redirect("/secrets");
        });
      }
    }
  );
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", (req, res) => {
  //   const username = req.body.username;
  //   const password = req.body.password;
  //   User.findOne({ email: username }, (err, user) => {
  //     if (!err) {
  //       if (user) {
  //         bcrypt.compare(password, user.password, (err, result) => {
  //           if (result === true) {
  //             res.render("secrets");
  //           } else {
  //             console.log("Password incorrect.");
  //           }
  //         });
  //       } else {
  //         console.log("User not found.");
  //       }
  //     } else {
  //       console.log(err);
  //     }
  //   });

  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });

  req.login(user, (err) => {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, () => {
        res.redirect("/secrets");
      });
    }
  });
});

app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

app.listen(3000, () => {
  console.log("Server started on port 3000");
});
