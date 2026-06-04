module.exports = {
  apps: [
    {
      name:          'wa-transcriber',
      script:        'src/index.js',
      restart_delay: 5000,       // wait 5s before restart on crash
      max_restarts:  20,
      watch:         false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
