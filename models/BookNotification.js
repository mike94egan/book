const bookshelf = require('../config/bookshelf')
bookshelf.plugin('registry')

const BookNotification = bookshelf.Model.extend({
    tableName: 'booknotification'
},
    {
        byISBN: function (ISBN) {
            return this.forge().query({ where: { ISBN: ISBN } }).fetchAll();
        }
    }
)


module.exports = bookshelf.model('BookNotification', BookNotification); 
