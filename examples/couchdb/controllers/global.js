var utils = require('partial.js/utils');
var builders = require('partial.js/builders');

exports.init = function() {
	this.route('/', viewDatabase);
};

function viewDatabase() {
	
	var self = this;
	var db = self.app.db();

	db.all({ limit: 10 }, function(err, data) {

		var rows = [];
		data.rows.forEach(function(o) {
			rows.push(o.id);
		});

		// return all rows
		self.plain(rows.join('\n'));

		// insert
		// @doc {Object}
		// @callback {Functions} :: optional
		db.insert({ name: 'Peter', age: 28 });

		// https://github.com/petersirka/partial.js/wiki/SK.framework.couchdb
	});
}