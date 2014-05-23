REPORTER = spec
MOCHA = node_modules/.bin/mocha

test:
	@NODE_ENV=test $(MOCHA) --require should --reporter $(REPORTER)

test-colors:
	@NODE_ENV=test $(MOCHA) --require should --reporter $(REPORTER) --colors

test-cov: test/coverage.html

test/coverage.html: lib-cov
	@FLUENTFFMPEG_COV=1 NODE_ENV=test $(MOCHA) --require should --reporter html-cov > test/coverage.html

lib-cov:
	@rm -fr ./$@
	@jscoverage lib $@

publish:
	@npm version patch -m "version bump"
	@npm publish

JSDOC = node_modules/.bin/jsdoc
JSDOC_CONF = tools/jsdoc-conf.json

doc:
	$(JSDOC) --configure $(JSDOC_CONF)

.PHONY: test test-cov lib-cov test-colors publish doc