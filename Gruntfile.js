module.exports = function(grunt) {

	grunt.initConfig({
		pkg: grunt.file.readJSON('package.json'),
		shell: {
			makeTest: {
				command: 'make test-colors',
				options: {
					stdout: true,
					stderr: true
				}
			}
		},
		lint: {
      files: ['grunt.js', 'lib/**/*.js']
    },
		watch: {
			scripts: {
				files: ['test/**/*.js','lib/**/*.js'],
				tasks: ['shell'],
				options: {
					nospawn: true,
				},
			},
		}
	});
	
	grunt.loadNpmTasks('grunt-contrib-watch');
	
	grunt.loadNpmTasks('grunt-shell');
	
	grunt.registerTask('test', ['shell']);
	
	grunt.registerTask('commit', ['shell']);
	
	grunt.registerTask('default', ['watch']);
};