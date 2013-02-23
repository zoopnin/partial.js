// Copyright Peter Širka, Web Site Design s.r.o. (www.petersirka.sk)
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var builders = require('./builders');
var utils = require('./utils');
var errors = ['Schema not defined.', 'Primary key not defined.', 'Parameter builder must be QueryBuilder type.', 'Parameter builder must be OrderBuilder type.', 'Timeout'];

/*	
	@fileName {String}
	@mode {String} :: optional, 'OPEN_READONLY', 'OPEN_READWRITE', 'OPEN_CREATE', default: OPEN_READWRITE | OPEN_CREATE
	@debug {Boolean} :: optional, default false (if true sqlite3 use verbose())
*/
function SQLite(fileName, mode, debug) {
	this.db = null;
	this.isOpened = false;
	this.fileName = fileName;
	this.mode = mode || '';
	this.debug = debug;
};

// ======================================================
// FUNCTIONS
// ======================================================

/*
	Prepare schema name
	@name {String}
	return {String}
*/
function prepareSchema(name) {
	var index = name.indexOf('#');
	if (index === 0)
		index = name.indexOf('/');

	return name.substring(index + 1);
}

// ====================================
// SQLite prototypes
// ====================================

/*
	Debug mode events
	on('trace')
	on('profile')
*/
SQLite.prototype.on = function(name, fn) {
	var self = this;
	self.open();
	self.db.on(name, fn);
	return self;
};

/*
	Get SQLite database object
*/
SQLite.prototype.database = function() {
	var self = this;
	self.open();
	return self.db;
};

/*
	Open SQLite database
    return {SQLite}
*/
SQLite.prototype.open = function() {
	var self = this;

	if (self.isOpened)
		return self;

	var sqlite3 = self.debug ? require('sqlite3').verbose() : require('sqlite3');
	self.db = new sqlite3.cached.Database(self.fileName, sqlite3[self.mode]);
	self.isOpened = true;
	return self;
};

/*
	Close SQLite database
    return {SQLite}
*/
SQLite.prototype.close = function() {
	var self = this;

	if (!self.isOpened)
		return self;

	return self;
};

/*
	Execute
	@sql {String}
    @params {Object}
    @callback {Function} :: function(err, data)
    return {SQLite}
*/
SQLite.prototype.execute = function(sql, params, callback) {
	
	var self = this;
	self.open();

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	params = self.make(params);

	var prepare = self.db.prepare(self.make(sql), params, function(err) {

		if (err)
			return callback(err, null);

		self.db.run(this.sql, params, function(err) {
			var obj = this;
			callback.call(self, err, err === null ? { id: obj.lastID, changes: obj.changes } : null);
		});
	});

	return self;
};

/*
	SQLite run command
	@sql {String}
    @params {Object}
    return {SQLite}
*/
SQLite.prototype.run = function(sql, params) {
	var self = this;
	self.open();
	self.db.run(sql, params);
	return self;
};

/*
	Get single row result
	@sql {String}
    @params {Object}
    @callback {Function} :: function(err, data)
    return {SQLite}
*/
SQLite.prototype.scalar = function(sql, params, callback) {
	return this.get(sql, params, callback);
};

/*
	Get single row result
	@sql {String}
    @params {Object}
    @callback {Function} :: function(err, data)
    return {SQLite}
*/
SQLite.prototype.get = function(sql, params, callback) {
	
	var self = this;
	self.open();

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.db.get(self.make(sql), self.make(params), function(err, data) {
		callback.call(self, err, err === null ? data || null : null);
	});

	return self;
};

/*
	Prepare params and SQL query
	@value {String or Object}
    return {String or Value}
*/
SQLite.prototype.make = function(value) {

	var type = typeof(value);

	if (value === null || type === 'undefined')
		return {};

	if (type === 'string')
		return value.replace(/\{/g, '$').replace(/\}/g, '');


	var isParam = value instanceof builders.QueryBuilder || value instanceof builders.ParameterBuilder;
	if (isParam)
		value = value.params;

	var arg = {};
	var self = this;

	Object.keys(value).forEach(function(o) {
		var val = value[o];

		if (utils.isDate(val))
			val = val.format('yyyy-MM-dd HH:mm:ss');

		arg['$' + o] = val;
	});

	return arg;
};

/*
	Reader
	@sql {String}
    @params {Object}
    @callback {Function} :: function(err, data)
    return {SQLite}
*/
SQLite.prototype.reader = function(sql, params, callback) {
	
	var self = this;
	self.open();

	if (typeof(params) == 'function') {
		callback = params;
		params = null;
	}

	self.db.all(self.make(sql), self.make(params), function(err, data) {
		callback.call(self, err, err === null ? data || [] : null);
	});

	return self;
};

/*
	Count
	@sql {String}
	@builder {QueryBuilder}
    @callback {Function} :: function(err, count)
    return {SQLite}
*/
SQLite.prototype.count = function(schema, builder, callback) {
	
	var self = this;
	var obj = builders.schema(schema);

	if (obj === null)
		throw new Error(errors[0]);

	if (typeof(builder) === 'function' && typeof(callback) === 'undefined') {
		callback = builder;
		builder = null;
	}

	var where = '';

	if (builder !== null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue())
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;
	}

	self.scalar('SELECT COUNT(*) As value FROM ' + prepareSchema(schema) + where, builder, function(err, data) {
		callback(err, err === null ? data.value : 0);
	});
	return self;
};

/*
	Find all
	@schema {String}
	@builder {QueryBuilder}
	@order {OrderBuilder}
	@take {Number}
	@skip {Number}
    @callback {Function} :: function(err, data)
    @without {String array} :: Without columns name
    return {SQLServer}
*/
SQLite.prototype.findAll = function(schema, builder, order, take, skip, callback, without) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var column = [];
	var first = '';

	take = take || 0;
	skip = skip || 0;
	without = without || [];

	Object.keys(obj).forEach(function(o, index) {
		if (without.indexOf(o) === -1) {
			if (index == 0)
				first = o;
			column.push(o);
		}
	});

	var where = '';
	var sort = '';

	if (builder !== null) {

		if (!(builder instanceof builders.QueryBuilder))
			throw new Error(errors[2]);

		if (builder.hasValue())
			where = ' WHERE ' + builder.builder.join(' ');

		builder.schema = obj;		
	}

	if (order !== null) {
		if (!(order instanceof builders.OrderBuilder))
			throw new Error(errors[3]);

		order.builder.forEach(function(o) {
			if (o.type == 'desc')
				sort += (sort.length > 0 ? ', ' : '') + o.name + ' DESC';
		});
	}

	var columns = column.join(', ');
	var query = query = 'SELECT ' + columns + ' FROM ' + prepareSchema(schema) + where + (sort.length > 0 ? ' ORDER BY ' + sort : '');


	if (take !== 0 && skip !== 0)		
		query += ' LIMIT ' + take + ' OFFSET ' + skip;
	else if (take !== 0)
		query += ' LIMIT ' + take;
	else if (skip !== 0)
		query += ' OFFSET ' + take;

	self.reader(query, builder, callback);
	return self;
};

SQLite.prototype.findTop = function(top, schema, builder, order, callback, without) {
	return this.findAll(schema, builder, order, top, 0, callback, without);
};

/*	
	Find by primary key
	@schema {String}
	@value {Object}
    @callback {Function} :: function(err, data)
    @without {String array} :: Without columns name
    return {SQLite}
*/
SQLite.prototype.findPK = function(schema, value, callback, without) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null) {
		throw new Error(errors[0]);
	}

	var primary = builders.primaryKey(schema);

	if (primary == null)
		throw new Error(errors[1]);

	var column = [];

	without = without || [];

	Object.keys(obj).forEach(function(o) {
		if (without.indexOf(o) === -1) {
			column.push(o);
		}
	});

	var columns = column.join(', ');
	var query = 'SELECT ' + columns + ' FROM ' + prepareSchema(schema) + ' WHERE ' + primary.name + '={' + primary.name + '} LIMIT 1';

	var param = {};
	param[primary.name] = value;

	self.get(query, param, callback);
	return self;
};

/*
	Insert record
	@schema {String}
	@value {Object}
    @callback {Function} :: function(err, data, changes)
    @without {String array} :: Without columns name
    return {SQLite}
*/
SQLite.prototype.insert = function(schema, value, callback, without) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var column = [];
	var values = [];
	without = without || [];

	var primary = builders.primaryKey(schema);
	var parameterBuilder = new builders.ParameterBuilder();
	parameterBuilder.schema = obj;

	if (primary !== null) {
		if (!primary.insert)
			without.push(primary.name);
	}

	Object.keys(obj).forEach(function(o, index) {
		if (without.indexOf(o) === -1) {
			column.push(o);
			values.push('{' + o + '}');
			parameterBuilder.add(o, value[o]);			
		}
	});

	var query = 'INSERT INTO ' + prepareSchema(schema) + '(' + column.join(',') + ') VALUES(' + values.join(',') + ')';
	self.execute(query, parameterBuilder, function(err, data) {
		if (err === null)
			value[primary.name] = data.id;
		callback(err, value, data.changes);
	});

	return self;
};

/*
	Update record
	@schema {String}
	@value {Object}
    @callback {Function} :: function(err, data, changes)
    @without {String array} :: Without columns name
    return {SQLite}
*/
SQLite.prototype.update = function(schema, value, callback, without) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var column = [];
	var values = [];
	without = without || [];

	var primary = builders.primaryKey(schema);
	var parameterBuilder = new builders.ParameterBuilder();
	parameterBuilder.schema = obj;

	if (primary === null)
		throw new Error(errors[1]);

	without.push(primary.name);

	Object.keys(obj).forEach(function(o, index) {

		if (without.indexOf(o) === -1)
			values.push(o + '={' + o + '}');

		parameterBuilder.add(o, value[o]);
	});

	var query = 'UPDATE ' + prepareSchema(schema) + ' SET ' + values.join(',') + ' WHERE ' + primary.name + '={' + primary.name + '}';

	self.execute(query, parameterBuilder, function(err, data) {
		callback(err, value, data.changes);
	});

	return self;
};

/*
	Delete record
	@schema {String}
	@value {Object}
    @callback {Function} :: function(err, data, changes)
    return {SQLite}
*/
SQLite.prototype.delete = function(schema, value, callback) {

	var self = this;

	var obj = builders.schema(schema);
	if (obj === null)
		throw new Error(errors[0]);

	var primary = builders.primaryKey(schema);
	var parameterBuilder = new builders.ParameterBuilder();
	parameterBuilder.schema = obj;

	if (primary === null)
		throw new Error(errors[1]);

	parameterBuilder.add(primary.name, value[primary.name]);

	var query = 'DELETE FROM ' + prepareSchema(schema) + ' WHERE ' + primary.name + '={' + primary.name + '}';

	self.execute(query, parameterBuilder, function(err, data) {
		callback(err, value, data.changes);
	});

	return self;
};

// ======================================================
// EXPORTS
// ======================================================

exports.database = exports.SQLite = exports.sqlite = SQLite;