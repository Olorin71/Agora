/*eslint no-process-exit: 0 */
/* eslint no-console: 0 */
/* eslint no-underscore-dangle: 0 */
'use strict';

const R = require('ramda');
const async = require('async');

require('./configure'); // initializing parameters
var beans = require('simple-configure').get('beans');
var activitystore = beans.get('activitystore');

var really = process.argv[2];
if (!really || really !== 'really') {
  console.log('If you want to run this script, append "really" to the command line.');
  process.exit();
}

activitystore.allActivities((err, activities) => {
  if (err) {
    console.log(err);
    process.exit();
  }
  var more = activities.filter(activity => activity.resourceNames().length > 1);

  more.forEach(activity => console.log(activity.title() + ' (url: ' + activity.url() + '-' + activity.resourceNames() + ')'));
  console.log(more.length + ' activites with multiple resources');

  var standardName = 'Veranstaltung';
  more.forEach(activity => {
    console.log(activity.title() + ' hat ' + activity.allRegisteredMembers().length + ' Registrierungen vorher');
    var resourcesPlain = activity.state.resources;
    var veranstaltung = {_registeredMembers: [], _registrationOpen: true};
    var newRegistrations = R.uniqBy(registration => registration.memberId, R.flatten(R.keys(resourcesPlain).map(name => resourcesPlain[name]._registeredMembers)));
    activity.state.resources = {};
    veranstaltung._registeredMembers = newRegistrations;
    activity.state.resources[standardName] = veranstaltung;
    delete activity.state._addons;
    console.log(activity.title() + ' hat ' + newRegistrations.length + ' Registrierungen nachher');
  });

  async.each(more, activitystore.saveActivity, err1 => {
    if (err1) {
      console.log(err1);
      process.exit();
    }
    console.log('all ' + more.length + ' activities with multiple resources converted');

    // now for the simple activities
    var simple = activities.filter(activity => activity.resourceNames().length === 1);
    console.log(simple.length + ' activites with onle one resource');
    console.log(R.uniq(simple.map(each => each.resourceNames())));
    var withWrongName = simple.filter(activity => !activity.state.resources[standardName]);
    withWrongName.forEach(activity => {
      var name = activity.resourceNames()[0];
      activity.state.resources[standardName] = activity.state.resources[name];
      delete activity.state.resources[name];
    });
    async.each(withWrongName, activitystore.saveActivity, err2 => {
      if (err2) {
        console.log(err2);
        process.exit();
      }
      console.log('all ' + withWrongName.length + ' activities with wrong resources converted');
      process.exit();
    });
  });

});
