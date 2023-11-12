REPORTER = spec
MOCHA = node_modules/.bin/mocha

test:
	@NODE_ENV=test $(MOCHA) --require should --reporter $(REPORTER)

test-colors:
	@NODE_ENV=test $(MOCHA) --require should --reporter $(REPORTER) --colors

publish:
	@npm version patch -m "version bump"
	@npm publish

JSDOC = node_modules/.bin/jsdoc
JSDOC_CONF = tools/jsdoc-conf.json

doc:
	$(JSDOC) --configure $(JSDOC_CONF)

.PHONY: test test-colors publish doc