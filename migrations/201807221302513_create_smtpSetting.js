
exports.up = function(knex, Promise) {
    return knex.schema.createTable('smtpsetting', function(t) {
		t.increments('smtpSettingID').primary();
        t.string('host').notNull();
		t.integer('port').notNull();
		t.boolean ('secure').notNull();		
		t.enum('type',['OAuth2','login']);
        t.string('user').notNull();
		t.string('password');		
		t.string('clientId');
		t.string('clientSecret');
		t.string('refreshToken');
		t.string('accessToken');
		t.string('from').notNull();
		t.enum('bodyType',['text','html']);	
		t.boolean ('sendEmail').notNull();				
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('smtpsetting');  
};

