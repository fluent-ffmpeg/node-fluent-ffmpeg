REPORTER = spec

test:
	@NODE_ENV=test mocha --require should --reporter $(REPORTER)
	
test-colors:
	@NODE_ENV=test mocha --require should --reporter $(REPORTER) --colors

test-cov: lib-cov
	@FLUENTFFMPEG_COV=1 $(MAKE) test REPORTER=html-cov > test/coverage.html

lib-cov:
	@rm -fr ./$@
	@jscoverage lib $@

publish: 
	@npm version patch -m "version bump"
	@npm publish

.PHONY: test test-cov lib-cov test-colors publish