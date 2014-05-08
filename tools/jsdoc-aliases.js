/*jshint node:true*/
'use strict';

function cloneDoclet(doclet) {
	var clone = {};

	Object.keys(doclet).forEach(function(key) {
		clone[key] = doclet[key];
	});

	return clone;
}

exports.handlers = {
	parseComplete: function(e) {
		var doclets = e.doclets.slice();

		doclets.forEach(function(doclet) {
			// Duplicate doclets with aliases
			if (doclet.aliases) {
				doclet.aliases.forEach(function(alias) {
					var clone = cloneDoclet(doclet);
					//console.dir(doclet);

					if (alias.indexOf('#') !== -1) {
						clone.longname = alias;
						clone.memberof = alias.split('#')[0];
						clone.name = alias.split('#')[1];
					} else {
						clone.longname = clone.memberof + '#' + alias;
						clone.name = alias;
					}

					delete clone.returns;
					delete clone.examples;
					delete clone.meta;
					delete clone.aliases;

					clone.isAlias = true;
					clone.description = 'Alias for <a href="#' + doclet.name + '">' + doclet.longname + '</a>';

					e.doclets.push(clone);
				});
			}
		});
	}
};

exports.defineTags = function(dict) {
	dict.defineTag('aliases', {
		onTagged: function(doclet, tag) {
			doclet.aliases = tag.text.split(',');
		}
	});

	dict.defineTag('category', {
		onTagged: function(doclet, tag) {
			doclet.category = tag.text;
		}
	});
};