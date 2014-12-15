module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    uglify: {
      options: {
        banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
      },
      build: {
        src: 'src/js/**/*.js',
        dest: 'dist/js/<%= pkg.name %>.min.js'
      }
    },
    karma: {
      unit: {
        configFile: 'karma.conf.js'
      }
    },
    jshint: {
      all: ['src/js/**/*.js']
    },
    notify_hooks: {
      options: {
        enabled: true,
        success: true // whether successful grunt executions should be notified automatically
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-karma');
  grunt.loadNpmTasks('grunt-notify');
  grunt.loadNpmTasks('grunt-contrib-jshint');

  // Default task(s).
  var buildTasks = ['jshint',  'karma', 'uglify'];
  
  var noTestTasks = buildTasks.filter(function(t){
    return t !== 'karma';
  }); 
  
  grunt.registerTask('test', ['karma']);
  grunt.registerTask('default', noTestTasks);
  grunt.registerTask('build', buildTasks);

  grunt.task.run('notify_hooks');
};
