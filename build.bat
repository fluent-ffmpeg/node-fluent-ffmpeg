@echo off
set REPORTER="list"

:test
	setx NODE_ENV "test"
	node_modules\.bin\mocha.cmd -u bdd --require should --reporter "%REPORTER%"
	setx NODE_ENV "development"