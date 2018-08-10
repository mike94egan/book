 
exports.up = function(knex, Promise) {
    return knex.schema.createTable('booknotification', function(t) {
		t.increments('notificationId').primary();	
        t.string('senderuser').notNull();
		t.string('senderemail').notNull();
		t.string('receiveruser').notNull();
		t.string('receiveremail').notNull();
        t.string('ISBN').notNull();
		t.date('notificationsentdate').notNull();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('booknotification');  
};
