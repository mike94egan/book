const express = require('express')
const router = express.Router()
const expressValidator = require('express-validator')
const User = require('../models/User')
const UserBook = require('../models/UserBook')
const UserWishlist = require('../models/UserWishlist')
const Book = require('../models/Book')
const BookNotification = require('../models/BookNotification')
const BookNotifications = require('../models/BookNotifications')
const SmtpSetting = require('../models/SmtpSetting')
const University = require('../models/University')
const bcrypt = require('bcrypt')
const saltRounds = 10;
const passport = require('passport');
var nodemailer = require('nodemailer');
var xoauth2 = require('xoauth2');
const path = require('path')

/* GET home page. */
router.get('/logedin',authenticationMiddleware(), async (req, res) => {
    var d = new Date();
    var year= d.getFullYear()
    var month = d.getMonth();
    month = month+1;
    var date = d.getDate();

    d = new Date(year+"-" + month + "-" + date);
    d.setDate(d.getDate() -105); //expiring in 15 days
    UserBook.expiringBooks(req.user.username, d).then(userBooks => {
        const ub = userBooks.toJSON();
        if( ub.length>0)
        {
            // send email
            var transporter;
            var mailOptions;

            SmtpSetting.forge().fetch().then(smtpinfo => {
                var smtpSetting  =smtpinfo.toJSON();
                if(smtpSetting.sendEmail)
                {
                    let transporterInfo = {
                        host: smtpSetting.host,
                        port: smtpSetting.port,
                        secure: smtpSetting.secure==1?true:false,
                        auth: {
                            type: smtpSetting.type,
                            user: smtpSetting.user
                        }
                        
                    };
                    if(smtpSetting.type == 'OAuth2')
                    {
                        transporterInfo.auth.clientId= smtpSetting.clientId;
                        transporterInfo.auth.clientSecret= smtpSetting.clientSecret;
                        // console.log(smtpSetting.refreshToken);
                        transporterInfo.auth.refreshToken= smtpSetting.refreshToken;
                        
                    }
                    else
                    {
                        transporterInfo.auth.password = smtpSetting.password;
                    }
                    
                    transporter = nodemailer.createTransport(transporterInfo);
                    
                    mailOptions = {
                    from: smtpSetting.from,
                    bcc: req.user.email,
                    subject: 'BookSwap: Your book is expiring soon.',
                    };

                    if(smtpSetting.bodyType == 'text')
                    {
                        mailOptions.text = 'Dear '+ req.user.username +', \n \n Your book is expiring in 15 Days. \n\n Thanks.';
                    }   
                    else
                    {
                        mailOptions.html ='<p>Dear <B>'+ req.user.username +'</B>  </Br> Your book is expiring in 15 Days. </br> Thanks.</P>';
                    }
                    transporter.sendMail(mailOptions, function(error, info){
                        if (error) {
                            console.log('ERROR');  
                        console.log(error);
                        } else {
                        console.log('Email sent: ' + info.response);
                        }
                    });
                }
            });
            res.render('index', { expiring: 15 })
        }
        else
        {
            res.render('index')
        }
      
    });
  
    
})
router.get('/', authenticationMiddleware(), async (req, res) => {
    // const user = await User.where('id', 1).fetch()
    // const username = user.get('username')
  
    console.log('</br>INDEX </br>');
    res.render('index')
})

router.get('/register', function (req, res) {
    res.render('register', { title: 'Registration' })
})



function validate(req) {
    req.checkBody('username', 'Username field cannot be empty.').notEmpty();
    req.checkBody('username', 'Username must be between 6-15 characters long.').len(6, 15);
    req.checkBody('email', 'The email you entered is invalid, please try again.').isEmail();
    req.checkBody('password1', 'Password must be between 8-100 characters long.').len(8, 100);
    req.checkBody("password1", "Password must include one lowercase character, one uppercase character, a number, and a special character.").matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?!.* )(?=.*[^a-zA-Z0-9]).{8,}$/, "i");
    req.checkBody('password2', 'Password must be between 8-100 characters long.').len(8, 100);
    req.checkBody("password2", "Password must include one lowercase character, one uppercase character, a number, and a special character.").matches(/^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?!.* )(?=.*[^a-zA-Z0-9]).{8,}$/, "i");
    req.checkBody('password2', 'Passwords do not match, please try again.').equals(req.body.password1);
    req.checkBody('username', 'Username can only contain letters, numbers, dots or underscores.').matches(/^[A-Za-z0-9_.-]+$/, 'i');
    return req.validationErrors();
}

router.post('/register', function (req, res) {
    const errors = validate(req);
    if (errors) {
        res.render('register', { title: "Registration", errors: errors })
    }
    else {
        const username = req.body.username;
        const firstName = req.body.firstName;
        const lastName = req.body.lastName;
        const email = req.body.email;
        const plainTextPassword = req.body.password1;
        const emailDomain = email.split("@")[1]
        University.byEmailDomain(emailDomain).then(university => {
            const universityID = university.get('universityID')
            new User({ 'username': username }).fetch().then((user)=> {console.log(user.toJSON()),res.render('register', { title: "Registration", dbError: "Username already Exists" }) })
                .catch(err => {
                    new User({ 'email': email }).fetch().then((user) => { console.log(user.toJSON()),res.render('register', { title: "Registration", dbError: "email already registered" }) })
                        .catch(erro => {
                            bcrypt.hash(plainTextPassword, saltRounds, function (err, hash) {
                                User.create({
                                    username: username, firstName: firstName, lastName: lastName
                                    , email: email, password: hash, universityID: universityID
                                }).then(user => { req.login(user, err => { res.redirect('/') }) })
                                    .catch(error => { res.render('register', { title: "Registration", dbError: "Database Error" }) })
                            })
                        })
                })
        }).catch(error => { res.render('register', { title: "Registration", dbError: "Your university is not licensed with us" }) })
    }
})

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    done(null, user);
});

function authenticationMiddleware() {
    return (req, res, next) => {
        if (req.isAuthenticated()) return next();
        res.redirect('/login')
    }
}

router.get('/login', function (req, res) {
    res.render('login', { title: 'Welcome to BookSwap' })
})

router.post('/login', function (req, res, next) {

    passport.authenticate('local', function (err, user, info) {
        if (err || !user) {
             return res.render('login', info); }
        req.logIn(user, function (err) {
            if (err) { return next(err); }
            return res.redirect('/logedin');
        });
    })(req, res, next);
})

router.get('/logout', function (req, res) {
    req.logout();
    req.session.destroy();
    res.redirect('/login')
})

router.get('/userbooks/:username', authenticationMiddleware(), function (req, res) {
    User.forge({ username: req.params.username }).fetch({ withRelated: ['myBooks'] })
        .then(user => {
            //console.log(user.toJSON());
            var userBooks = user.related('myBooks');
            //console.log(userBooks.toJSON());
            userBooks.fetch({ withRelated: ['book'] })
                .then(userBooks => {
                    res.render('userbooks', { title: "My books", data: userBooks.toJSON() })
                }
                )
        })
})

router.post('/userbooks/:username', authenticationMiddleware(), (req, res) => {
    if (req.body.type == 'sell') {
        UserBook.sell(req.body.userbookID,req.body.comments).then(res.redirect('/userbooks/' + req.user.username))
    }
    else if (req.body.type = 'swap') {
        UserBook.swap(req.body.userbookID,req.body.comments).then(res.redirect('/userbooks/' + req.user.username))
    }
})

router.get('/mywishlist', authenticationMiddleware(), function (req, res) {
    const username = req.user.username
    User.forge({ username: username }).fetch({ withRelated: ['myWishlist'] })
        .then(user => {
            var userWishlist = user.related('myWishlist');
            userWishlist.fetch({ withRelated: ['book'] })
                .then(userWishlist => {                    
                    res.render('mywishlist', { title: "My wishlist", data: userWishlist.toJSON() })
                }
                )
        })
})

router.post('/mywishlist', authenticationMiddleware(),(req,res)=>{
    if(req.body.wishlistID){
        UserWishlist.remove(req.body.wishlistID).then(
            res.redirect('mywishlist')
        )
    }
})

router.get('/postbook', authenticationMiddleware(), function (req, res) {   
    if (req.query.ISBNbook) {
        Book.byISBN(req.query.ISBNbook).then(book => {
            res.render('postbook', { book: book.toJSON() })
        })
    }
    else {
        res.render('postbook')
    }
})

router.post('/postbook', authenticationMiddleware(), function (req, res) {
   
    const data = {
        username: req.user.username,
        ISBN: req.body.ISBN,
        dateUploaded: new Date(),
        condition: req.body.condition,
        pictures: "no-image-available.jpg",
        availableDate: req.body.availableDate,
        transaction: req.body.transaction,
        flag: "current",
        status: "available"
    }
    UserBook.create(data).then
    (
    userBook =>
    {   
        UserBook.forge({ userbookID: userBook.id }).fetch({ withRelated: ['user'] }).then
        (
        userBook => 
        {
            var senderUser = userBook.related('user');
            const senderUserName = req.user.username;
            const senderEmail = senderUser.get('email');
            
            UserWishlist.byISBN(req.body.ISBN).then
            (
            userWishlist => 
            {   
                const wishlists = userWishlist.toJSON();
                //console.log(wishlists);
                var bookNotifications = []
                for (var i = 0; i < wishlists.length; i++) {
                    bookNotification = {
                        senderuser: senderUserName,
                        senderemail:senderEmail,
                        receiveruser:wishlists[i].username,
                        receiveremail:wishlists[i].user.email,
                        isbn: wishlists[i].ISBN,
                        notificationsentdate: new Date()
                    };

                    bookNotifications.push( bookNotification);
                }
                var transporter;
                var mailOptions;

                SmtpSetting.forge().fetch().then(smtpinfo => {
                    var smtpSetting  =smtpinfo.toJSON();
                    if(smtpSetting.sendEmail)
                    {
                        let transporterInfo = {
                            host: smtpSetting.host,
                            port: smtpSetting.port,
                            secure: smtpSetting.secure==1?true:false,
                            auth: {
                                type: smtpSetting.type,
                                user: smtpSetting.user
                            }
                            
                        };
                        if(smtpSetting.type == 'OAuth2')
                        {
                            transporterInfo.auth.clientId= smtpSetting.clientId;
                            transporterInfo.auth.clientSecret= smtpSetting.clientSecret;
                            // console.log(smtpSetting.refreshToken);
                            transporterInfo.auth.refreshToken= smtpSetting.refreshToken;
                            
                        }
                        else
                        {
                            transporterInfo.auth.password = smtpSetting.password;
                        }
                        
                        transporter = nodemailer.createTransport(transporterInfo);
                        console.log('INHOUSE transporter is '+ transporter);
                        mailOptions = {
                        from: smtpSetting.from,
                        bcc: bookNotifications.map(e => e.receiveremail).join(","),
                        subject: 'BookSwap: book '+ bookNotifications[0].isbn+' availability.',
                        };

                        if(smtpSetting.bodyType == 'text')
                        {
                            mailOptions.text = 'Thanks for showing interest in book ISBN '+ bookNotifications[0].isbn +' and the book is available on '+req.body.availableDate+' Thanks,';
                        }   
                        else
                        {
                            mailOptions.html ='<p>Thanks for showing interest in book ISBN <B>'+ bookNotifications[0].isbn +'</B> and the book is available on <B>'+req.body.availableDate+'<B> </Br> Thanks,</P>';
                        }
                        transporter.sendMail(mailOptions, function(error, info){
                            if (error) {
                                console.log('ERROR');  
                            console.log(error);
                            } else {
                            console.log('Email sent: ' + info.response);
                            }
                        });
                        console.log('DONE');

                        var notifications = BookNotifications.forge(bookNotifications)	

                        notifications.invokeThen('save');
                    }
                });
            });
            res.redirect('/userbooks/' + req.user.username)
        })
    })
})

router.get('/viewresults/:ISBN', authenticationMiddleware(), function (req, res) {
    Book.forge({ ISBN: req.params.ISBN }).fetch({ withRelated: ['userBooks'] })
        .then(book => {
            var userBooks = book.related('userBooks');
            userBooks.fetch({ withRelated: ['user'] })
                .then(userBooks => {
                    res.render('viewresults', { title: "view results", book: book.toJSON() })
                }
                )
        })
})

router.get('/searchresults', function (req, res, next) {
    if (req.query.search) {
        const searchIfISBN = req.query.search.replace(/-/g, "");
        if (/^\d+$/.test(searchIfISBN)) {
            Book.byISBN(req.query.search).then(book => {
                res.render('searchresults', { search: req.query.search, books: book.toJSON() })
            })
        }
        else {
            Book.byAuthorOrTitle(req.query.search).then(books => {
                res.render('searchresults', { search: req.query.search, books: books.toJSON() })
            })
        }
    }
    else {
        const university = req.query.university
        const department = req.query.department
        const course = req.query.course
        University.search(university, department, course).then(universities => {
            const univ = universities.toJSON()
            var books = {}
            for (var i = 0; i < univ.length; i++) {
                book = univ[i].book
                books[i] = book
            }
            res.render('searchresults', {
                university: req.query.university,
                department: req.query.department,
                course: req.query.course, books: books
            })
        })
    }
})

router.post('/searchresults', function (req, res) {
    UserWishlist.create({ username: req.user.username, ISBN: req.body.Wishlist }).then(body => {
        res.redirect('mywishlist')
    })
})

router.get('/aboutus', function (req, res) {
    res.render('aboutus', { title: 'About Us' })
})

router.get('/contactus', function (req, res) {
    res.render('contactus', { title: 'Contact Us' })
})

router.post('/contactus', authenticationMiddleware(), function (req, res) {
    var transporter;
    var mailOptions;
    const username = req.body.username;
    const email = req.body.email;
    const message = req.body.message;
    const subject = req.body.subject;
    const email1 = 'bookswapauth@gmail.com'

    SmtpSetting.forge().fetch().then(smtpinfo => {
        var smtpSetting  =smtpinfo.toJSON();
        let transporterInfo = {
            host: smtpSetting.host,
            port: smtpSetting.port,
            secure: smtpSetting.secure==1?true:false,
            auth: {
                type: smtpSetting.type,
                user: smtpSetting.user
            }
                            
        };
        if(smtpSetting.type == 'OAuth2')
        {
            transporterInfo.auth.clientId= smtpSetting.clientId;
            transporterInfo.auth.clientSecret= smtpSetting.clientSecret;
            transporterInfo.auth.refreshToken= smtpSetting.refreshToken;
                       
        }
        else
        {
            transporterInfo.auth.password = smtpSetting.password;
        }
                        
        transporter = nodemailer.createTransport(transporterInfo);
        console.log('INHOUSE transporter is '+ transporter);
        mailOptions = {
        from: smtpSetting.from,
        bcc: email1,
        subject: subject,
        };

        if(smtpSetting.bodyType == 'text')
        {
            mailOptions.text = message;
        }   
        else
        {
            mailOptions.html ='<p>hello</p>';
        }
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log('ERROR');  
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        }); 
    })               

    res.render('contactus', { title: 'Contact Us' })
})

router.get('/faq', function (req, res) {
    res.render('faq', { title: 'FAQ' })
})

router.get('/howitworks', function (req, res) {
    res.render('howitworks', { title: 'How It Works' })
})

router.get('/index', function (req, res) {
    res.render('index', { title: 'Index' })
})

router.get('/participatingunis', function (req, res) {
    res.render('participatingunis', { title: 'Participating Universities' })
})

router.get('/tc', function (req, res) {
    res.render('tc', { title: 'Terms & Conditions' })
})

router.get('/pwreset', function (req, res) {
    res.render('pwreset', { title: 'Password Reset' })
})

router.post('/pw', function (req, res) {
    var transporter;
    var mailOptions;

    const username = req.body.username;
    const email = req.body.email;
    

    SmtpSetting.forge().fetch().then(smtpinfo => {
        var smtpSetting  =smtpinfo.toJSON();
        let transporterInfo = {
            host: smtpSetting.host,
            port: smtpSetting.port,
            secure: smtpSetting.secure==1?true:false,
            auth: {
                type: smtpSetting.type,
                user: smtpSetting.user
            }
                            
        };
        if(smtpSetting.type == 'OAuth2')
        {
            transporterInfo.auth.clientId= smtpSetting.clientId;
            transporterInfo.auth.clientSecret= smtpSetting.clientSecret;
            transporterInfo.auth.refreshToken= smtpSetting.refreshToken;
                       
        }
        else
        {
            transporterInfo.auth.password = smtpSetting.password;
        }
                        
        transporter = nodemailer.createTransport(transporterInfo);
        console.log('INHOUSE transporter is '+ transporter);
        function validate(req) {
            req.checkBody('password2').equals(req.body.password1);
            return req.validationErrors();
        }
        mailOptions = {
        from: smtpSetting.from,
        bcc: email,
        subject: 'Password Reset',
        };

        if(smtpSetting.bodyType == 'text')
        {
            ;
        }   
        else
        {
            mailOptions.html ='<p>hello</p>';
        }
        transporter.sendMail(mailOptions, function(error, info){
            if (error) {
                console.log('ERROR');  
                console.log(error);
            } else {
                console.log('Email sent: ' + info.response);
            }
        }); 
    })    
    res.render('password', { title: 'Forgot Password' })
})

module.exports = router
