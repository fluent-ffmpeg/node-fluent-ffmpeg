REPORTER = spec
MOCHA = node_modules/.bin/mocha
NYC = node_modules/.bin/nyc

test:
	@NODE_ENV=test $(MOCHA) --require should --reporter $(REPORTER)

test-colors:
	@NODE_ENV=test $(MOCHA) --require should --reporter $(REPORTER) --colors

test-cov: 
	@FLUENTFFMPEG_COV=1 NODE_ENV=test ${NYC} $(MOCHA) --require should

publish:
	@npm version patch -m "version bump"
	@npm publish

JSDOC = node_modules/.bin/jsdoc
JSDOC_CONF = tools/jsdoc-conf.json

doc:
	$(JSDOC) --configure $(JSDOC_CONF)

.PHONY: test test-cov test-colors publish doc
