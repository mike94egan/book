const bookshelf = require('../config/bookshelf')
const BookNotification = require('../models/BookNotification')
bookshelf.plugin('registry')
var Promise = require('bluebird');

var BookNotifications = bookshelf.Collection.extend({
  model: BookNotification,
});

module.exports = bookshelf.model('BookNotifications', BookNotifications); 
