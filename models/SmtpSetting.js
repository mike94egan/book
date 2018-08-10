const bookshelf = require('../config/bookshelf')
bookshelf.plugin('registry')

const SMTPSetting = bookshelf.Model.extend({
    tableName: 'smtpsetting'
});

module.exports = bookshelf.model('SmtpSetting', SMTPSetting);
