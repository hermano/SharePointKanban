/// <reference path="../scripts/typings/jquery.d.ts" />
/// <reference path="../scripts/typings/angular.d.ts" />
/// <reference path="../scripts/typings/angular-ui-router.d.ts" />
/// <reference path="../scripts/typings/angular-ui-bootstrap.d.ts" />
/// <reference path="../scripts/typings/angular-sanitize.d.ts" />
/// <reference path="../scripts/typings/moment/moment.d.ts" />
/// <reference path="../scripts/typings/q/q.d.ts" />
/// <reference path="../scripts/typings/toastr/toastr.d.ts" />
'use strict';
/**
 * SharePoint Kanban (Signboard) Angular Application
 * by John Bonfardeci <john.bonfardeci@gmail.com>
 * Created: December 2015
 * Modified:January 16,2016
 */
var App;
(function (App) {
    App.app = angular.module("app", [
        // Angular modules 
        'ngSanitize',
        // Custom modules 
        'config',
        'common',
        // 3rd Party Modules
        'ui.bootstrap',
        'ui.router'
    ]);
})(App || (App = {}));
var App;
(function (App) {
    var Views = (function () {
        function Views() {
        }
        /////////////////////
        // The Kanban Config
        /////////////////////
        Views.projects = {
            templateUrl: 'app/kanban/kanban.htm' + App.Utils.getTimestamp(),
            controller: 'kanbanController',
            controllerAs: 'vm',
            resolve: {
                // Change SharePoint Project/Tasks configurations as needed. 
                // This will be injected into the Kanban Controller
                kanbanConfig: function () {
                    var statuses = ['Not Started', 'In Progress', 'Testing', 'Completed'];
                    var config = {
                        siteUrl: '/',
                        listName: 'Tasks',
                        previousMonths: 18,
                        timeLogListName: 'Time Log',
                        statuses: statuses,
                        columns: [
                            {
                                title: 'Queue',
                                id: 'backlog-tasks',
                                className: 'panel panel-info',
                                status: statuses[0],
                                tasks: []
                            },
                            {
                                title: 'In Progress',
                                id: 'in-progress-tasks',
                                className: 'panel panel-danger',
                                status: statuses[1],
                                tasks: []
                            },
                            {
                                title: 'Testing',
                                id: 'testing-tasks',
                                className: 'panel panel-warning',
                                status: statuses[2],
                                tasks: []
                            },
                            {
                                title: 'Done',
                                id: 'completed-tasks',
                                className: 'panel panel-success',
                                status: statuses[3],
                                tasks: []
                            }
                        ]
                    };
                    return config;
                }
            }
        };
        ///////////////////////////
        // Project Summary Reports
        ///////////////////////////
        Views.summary = {
            templateUrl: 'app/reports/summary.htm' + App.Utils.getTimestamp(),
            controller: 'projectSummaryController',
            controllerAs: 'vm',
            resolve: {
                projectSiteConfigs: function () {
                    // List as many SharePoint Project/Tasks configurations here as needed. 
                    return [
                        { siteUrl: '/', listName: 'Time Log', title: 'Projects', projectsListName: 'Tasks' }
                    ];
                }
            }
        };
        /////////////
        // Main Menu
        /////////////
        Views.menu = {
            templateUrl: 'app/menu/menu.htm' + App.Utils.getTimestamp(),
            controller: 'menuController',
            controllerAs: 'vm' // the alias of the Angular controller in the HTML templates; `vm` short for 'View Model'
        };
        ///////////
        // Footer
        ///////////
        Views.footer = {
            templateUrl: 'app/footer/footer.htm' + App.Utils.getTimestamp(),
            controller: 'footerController',
            controllerAs: 'vm'
        };
        return Views;
    })();
    App.Views = Views;
})(App || (App = {}));
/**
* Central configuration of all application state routes via Angular UI Router
*
* Inject not only reusable dependencies but reusable views to assemble dashboards in any way necessary! Perfect Dependency Injection.
* 'DVR - Dependencies, Views, and Routes' - John Bonfardeci
*/
var App;
(function (App) {
    var Routes = (function () {
        function Routes(config, $stateProvider, $urlRouterProvider) {
            // the default url if url doesn't match any of the Angular UI Router states
            $urlRouterProvider.otherwise('/');
            config.routes.forEach(function (r) {
                $stateProvider.state(r.route, r.model);
            });
        }
        Routes.$inject = ['config', '$stateProvider', '$urlRouterProvider'];
        return Routes;
    })();
    App.Routes = Routes;
    App.app.config(Routes);
})(App || (App = {}));
var App;
(function (App) {
    var Controllers;
    (function (Controllers) {
        var FooterController = (function () {
            function FooterController(config) {
                this.config = config;
                this.copyright = '&copy; ' + config.orgName + ' ' + new Date().getFullYear();
            }
            FooterController.Id = 'footerController';
            FooterController.$inject = ['config'];
            return FooterController;
        })();
        Controllers.FooterController = FooterController;
        App.app.controller(FooterController.Id, FooterController);
    })(Controllers = App.Controllers || (App.Controllers = {}));
})(App || (App = {}));
var App;
(function (App) {
    var Controllers;
    (function (Controllers) {
        var KanbanController = (function () {
            function KanbanController($scope, common, config, $stateParams, datacontext, kanbanConfig) {
                this.$scope = $scope;
                this.common = common;
                this.config = config;
                this.$stateParams = $stateParams;
                this.datacontext = datacontext;
                this.kanbanConfig = kanbanConfig;
                this.projects = [];
                // used by directive, `kanbanColumn`, to reference the current task being dragged over it.
                this.dragging = {
                    task: null
                };
                this.siteUrl = kanbanConfig.siteUrl;
                this.listName = kanbanConfig.listName;
                this.columns = kanbanConfig.columns;
                this.statuses = kanbanConfig.statuses;
                this.priorities = this.config.priorities;
                this.$parent = this.$scope.$parent.shell;
                this.changeQueue = [];
                this.currentUser = this.$parent.currentUser;
                this.userIsEditor = App.Utils.userIsEditor(this.currentUser, this.config.editGroups);
                this.now = new Date();
                this.refreshData();
                document.getElementById('keywordFilter').focus();
            }
            KanbanController.prototype.saveChanges = function () {
                if (!confirm('Are you sure you want to save changes to ' + this.changeQueue.length + ' items?')) {
                    return false;
                }
                var self = this;
                // update the list item on the server
                this.datacontext.updateSoapListItems(this.changeQueue, this.siteUrl, this.listName).then(function (response) {
                    var xmlDoc = response.data;
                    if (!!xmlDoc) {
                        self.changeQueue = [];
                    }
                });
                return false;
            };
            KanbanController.prototype.resetData = function () {
                this.projects = [];
                this.projects = angular.copy(this.pristineProjectsData, this.projects);
                this.updateColumns();
                this.changeQueue = [];
                return false;
            };
            KanbanController.prototype.updateTask = function (taskId, field, index) {
                if (index === void 0) { index = undefined; }
                var self = this;
                for (var i = 0; i < this.projects.length; i++) {
                    if (this.projects[i].Id != taskId) {
                        continue;
                    }
                    var task = this.projects[i];
                    //If the change is already qeued, update its fields.
                    var change = this.changeQueue.filter(function (t) {
                        return t.Id == taskId;
                    });
                    switch (field.name) {
                        case 'Status':
                            task.Status.Value = field.value;
                            // Clock out the task if clocked in and not working.
                            if (/(not started|completed)/i.test(field.value) && task.LastTimeOut == null) {
                                self.clockOut(task.Id);
                            }
                            break;
                        case 'TaskStatus':
                            task.TaskStatus.Value = field.value;
                            // Clock out the task if clocked in and not working.
                            if (/(not started|completed)/i.test(field.value) && task.LastTimeOut == null) {
                                self.clockOut(task.Id);
                            }
                            break;
                        case 'OrderBy':
                            //update the order if an OrderBy change
                            if (!!!index) {
                                break;
                            }
                            break;
                        default:
                            break;
                    }
                    if (change.length > 0) {
                        // update existing field changes
                        var fields = change[0].fields.filter(function (f) {
                            return f.name == field.name;
                        });
                        if (fields.length > 0) {
                            fields[0].value = field.value;
                        }
                        else {
                            change[0].fields.push(field);
                        }
                    }
                    else {
                        this.changeQueue.push({
                            Id: taskId,
                            fields: [field]
                        });
                    }
                    if (this.config.debug) {
                        console.log(this.changeQueue);
                    }
                    this.updateColumns();
                    return i;
                }
                return -1;
            };
            KanbanController.prototype.updateColumns = function (apply) {
                if (apply === void 0) { apply = false; }
                var self = this;
                for (var i = 0; i < this.columns.length; i++) {
                    var col = this.columns[i];
                    col.tasks = self.projects.filter(function (task) {
                        return (task.Status || task.TaskStatus).Value == col.status; // handle SP 2010 or 2013 property name
                    });
                }
                //force a redraw of the columns if dragging projects around
                if (!!this.dragging.task || apply) {
                    this.$scope.$apply();
                    if (this.config.debug) {
                        console.info('redraw');
                    }
                }
            };
            KanbanController.prototype.deleteTask = function (task, index) {
                var self = this;
                if (!confirm('Are you sure you want to delete the item with ID# ' + task.Id + '?')) {
                    return;
                }
                this.datacontext.deleteListItem(task).then(function (response) {
                    App.Utils.remove(self.projects, index);
                    self.updateColumns(true);
                });
                return false;
            };
            KanbanController.prototype.refreshData = function () {
                var self = this;
                this.datacontext.getProjects(this.siteUrl, this.listName, true, this.kanbanConfig.previousMonths).then(function (projects) {
                    self.projects = projects;
                    self.updateColumns();
                    self.pristineProjectsData = angular.copy(self.projects, self.pristineProjectsData);
                });
                return false;
            };
            KanbanController.prototype.viewItem = function (task) {
                var self = this;
                App.SharePoint.Utils.openSpDisplayForm(this.siteUrl, this.listName, task);
                return false;
            };
            KanbanController.prototype.newItem = function () {
                var self = this;
                App.SharePoint.Utils.openSpNewForm(this.siteUrl, this.listName, 'New Item', function () {
                    console.info(arguments);
                    self.refreshData();
                });
                return false;
            };
            KanbanController.prototype.range = function (end) {
                var a = [];
                for (var i = 1; i <= end; i++) {
                    a.push(i);
                }
                return a;
            };
            KanbanController.prototype.clockIn = function (id) {
                var self = this;
                try {
                    var project = this.findProjectById(id);
                    if (!!!project) {
                        var ex = 'ERROR: Controllers.KanBanController.clockIn() - project is null';
                        alert(ex);
                        throw ex;
                        return false;
                    }
                    var now = new Date();
                    project.LastTimeIn = now;
                    project.LastTimeOut = null;
                    var url = self.kanbanConfig.siteUrl + '/_vti_bin/listdata.svc/' + App.SharePoint.Utils.toCamelCase(self.kanbanConfig.timeLogListName);
                    var timeEntryPayload = JSON.stringify({
                        ProjectId: id,
                        TimeIn: now.toISOString()
                    });
                    this.datacontext.executeRestRequest(url, timeEntryPayload, false, 'POST')
                        .then(function (response) {
                        if (self.config.debug) {
                            console.info('Controllers.KanBanController.clockIn() returned...');
                            console.info(response);
                        }
                        // if not 201 (Created)
                        if (response.status != 201) {
                            alert('Error creating entry in ' + self.kanbanConfig.timeLogListName + '. Status: ' + response.status + '; Status Text: ' + response.statusText);
                            //console.warn(response);
                            return;
                        }
                        // update project fields in memory
                        // setting LastTimeOut to null allows the project to show up in the Working Now section.
                        var projectPayload = {
                            LastTimeIn: App.Utils.parseMsDateTicks(response.data.d.TimeIn),
                            LastTimeOut: null
                        };
                        self.datacontext.updateListItem(project, projectPayload, function (data, statusText, jqXhr) {
                            // if not 204 (Updated)
                            if (self.config.debug) {
                                console.info('clockIn()');
                                console.info(arguments);
                            }
                            if (!!jqXhr && jqXhr.status != 204) {
                                alert('Error in Kanban.clockIn(). Failed to clock out.');
                                return;
                            }
                            project.LastTimeIn = projectPayload.LastTimeIn;
                            project.LastTimeOut = null;
                        });
                    });
                }
                catch (e) {
                    alert('ERROR: Controllers.KanBanController.clockIn()');
                    throw e;
                }
                finally {
                    return false;
                }
            };
            KanbanController.prototype.clockOut = function (id) {
                var self = this;
                try {
                    var project = this.findProjectById(id);
                    var ex = 'ERROR: Controllers.KanBanController.clockOut() - project is null';
                    alert(ex);
                    throw ex;
                    var now = new Date();
                    //Query the last time entry to get the ID, then update the TimeOut field to now.
                    this.datacontext.getSpListItems(this.kanbanConfig.siteUrl, this.kanbanConfig.timeLogListName, 'ProjectId eq ' + project.Id, null, 'Id desc', null, 1).then(function (items) {
                        var timeLog = items[0]; // Using `$top` returns a plain Array, not an Array named "results".
                        var projectPayload = {
                            LastTimeOut: now.toISOString()
                        };
                        var timeLogPayload = {
                            TimeOut: now.toISOString()
                        };
                        //Update list item in time log list
                        self.datacontext.updateListItem(timeLog, timeLogPayload, function (data, statusText, jqXhr) {
                            if (self.config.debug) {
                                console.info('clockOut()');
                                console.info(arguments);
                            }
                            if (!!jqXhr && jqXhr.status != 204) {
                                alert('Error in Kanban.clockOut(). Failed to clock out.');
                                return;
                            }
                        });
                        //Update listitem in project/task list
                        self.datacontext.updateListItem(project, projectPayload, function (data, statusText, jqXhr) {
                            if (self.config.debug) {
                                console.info('clockOut()');
                                console.info(arguments);
                            }
                            if (!!jqXhr && jqXhr.status != 204) {
                                alert('Error in Kanban.clockOut(). Failed to clock out.');
                                return;
                            }
                            project.LastTimeOut = now;
                            self.updateColumns(true);
                        });
                    });
                }
                catch (e) {
                    alert('ERROR: Controllers.KanBanController.clockOut()');
                    throw e;
                }
                finally {
                    return false;
                }
            };
            KanbanController.prototype.findProjectById = function (id) {
                if (this.projects == null) {
                    return null;
                }
                for (var i = 0; i < this.projects.length; i++) {
                    if (this.projects[i].Id == id) {
                        return this.projects[i];
                    }
                }
                return null;
            };
            KanbanController.prototype.isActive = function (task) {
                return task.LastTimeOut == null && task.LastTimeIn != null;
            };
            KanbanController.Id = 'kanbanController';
            KanbanController.$inject = ['$scope', 'common', 'config', '$stateParams', 'datacontext', 'kanbanConfig'];
            return KanbanController;
        })();
        Controllers.KanbanController = KanbanController;
        App.app.controller(KanbanController.Id, KanbanController);
    })(Controllers = App.Controllers || (App.Controllers = {}));
})(App || (App = {}));
var App;
(function (App) {
    var Controllers;
    (function (Controllers) {
        var MenuController = (function () {
            function MenuController($scope, config, $state, $stateParams) {
                this.$scope = $scope;
                this.config = config;
                this.$state = $state;
                this.$stateParams = $stateParams;
                var $parent = this.$scope.$parent.shell;
                this.currentUser = $parent.currentUser;
                this.appTitle = config.appTitle;
                this.routes = config.routes.filter(function (r) {
                    return r.showInMenu;
                });
            }
            MenuController.Id = 'menuController';
            MenuController.$inject = ['$scope', 'config', '$state', '$stateParams'];
            return MenuController;
        })();
        Controllers.MenuController = MenuController;
        App.app.controller(MenuController.Id, MenuController);
    })(Controllers = App.Controllers || (App.Controllers = {}));
})(App || (App = {}));
var App;
(function (App) {
    var Controllers;
    (function (Controllers) {
        var ProjectSummary = (function () {
            function ProjectSummary($state, $stateParams, datacontext, projectSiteConfigs) {
                this.$state = $state;
                this.$stateParams = $stateParams;
                this.datacontext = datacontext;
                this.projectSiteConfigs = projectSiteConfigs;
                this.updateState = false;
                // default dates to current week from Mon to Sun
                var today = new Date();
                var dayOfWeek = today.getDay(); //index of the week - 0-6 - Sun-Sat
                var dayOfMonth = today.getDate();
                var firstDayOfWeek = 1; // Monday - change to your preference, e.g `0` for Sunday etc.
                var lastDayOfWeek = 6;
                // if today's date isn't a the beginning of your week, find the previous date that was. 
                var startDate = dayOfWeek == firstDayOfWeek ? dayOfMonth : dayOfMonth - (dayOfWeek - firstDayOfWeek);
                if (!!$stateParams.start && !!$stateParams.end) {
                    var start = $stateParams.start.split('-');
                    var end = $stateParams.end.split('-');
                    this.startDate = new Date(parseInt(start[0]), (parseInt(start[1]) - 1), parseInt(start[2]), 0, 0, 0);
                    this.endDate = new Date(parseInt(end[0]), (parseInt(end[1]) - 1), parseInt(end[2]), 23, 59, 0);
                    this.getData();
                }
                else {
                    this.updateState = true;
                    this.startDate = new Date(today.getFullYear(), today.getMonth(), startDate, 0, 0, 0);
                    this.endDate = new Date(today.getFullYear(), today.getMonth(), (startDate + lastDayOfWeek), 23, 59, 0);
                }
                this.groupedProjects = [];
            }
            ProjectSummary.prototype.getData = function () {
                var self = this;
                this.groupedProjects = [];
                for (var i = 0; i < this.projectSiteConfigs.length; i++) {
                    var config = self.projectSiteConfigs[i];
                    var groupTitle = self.projectSiteConfigs[i].title;
                    var names = []; //to keep track of unique names
                    this.datacontext.getProjectTotals(config.siteUrl, config.listName, this.startDate, this.endDate, groupTitle, config.projectsListName).then(function (data) {
                        // group multiple project groups under each unique person                        
                        data.forEach(function (o) {
                            var name = o.Name;
                            if (names.indexOf(name) < 0) {
                                names.push(name);
                                self.groupedProjects.push({
                                    Name: name,
                                    ProjectGroups: [{
                                            Title: o.Title,
                                            Projects: o.Projects
                                                .filter(function (p) { return p.PersonName == name; })
                                                .sort(function (a, b) { return a.TotalHours < b.TotalHours ? 1 : 0; })
                                        }]
                                });
                            }
                            else {
                                self.groupedProjects.filter(function (person) {
                                    return person.Name == name;
                                })[0].ProjectGroups.push({
                                    Title: o.Title,
                                    Projects: o.Projects
                                        .filter(function (p) { return p.PersonName == name; })
                                        .sort(function (a, b) { return a.TotalHours < b.TotalHours ? 1 : 0; })
                                });
                            }
                        });
                    });
                }
                return false;
            };
            ProjectSummary.prototype.viewItem = function (project) {
                var self = this;
                var item = {
                    Id: project.Id,
                    Title: project.Title
                };
                App.SharePoint.Utils.openSpDisplayForm(project.SiteUrl, project.ListName, item);
                return false;
            };
            ProjectSummary.Id = 'projectSummaryController';
            ProjectSummary.$inject = ['$state', '$stateParams', 'datacontext', 'projectSiteConfigs'];
            return ProjectSummary;
        })();
        Controllers.ProjectSummary = ProjectSummary;
        App.app.controller(ProjectSummary.Id, ProjectSummary);
    })(Controllers = App.Controllers || (App.Controllers = {}));
})(App || (App = {}));
var App;
(function (App) {
    App.app.run(['$rootScope', '$state', '$stateParams', function run($rootScope, $state, $stateParams) {
            $rootScope.$state = $state;
            $rootScope.$stateParams = $stateParams;
            // jumpstart the routes
            $state.go('app.home');
        }]);
})(App || (App = {}));
var App;
(function (App) {
    var Services;
    (function (Services) {
        var Datacontext = (function () {
            function Datacontext($http, $q, common, config) {
                this.$http = $http;
                this.$q = $q;
                this.common = common;
                this.config = config;
                this.cache = {};
                this.common.hideLoader();
            }
            /**
            * Execute a REST request.
            * @param url: string
            * @param method?: string = 'GET'
            * @param headers?: Object = undefined
            * @return IPromise<any>
            */
            Datacontext.prototype.executeRestRequest = function (url, data, cache, method, headers) {
                if (data === void 0) { data = undefined; }
                if (cache === void 0) { cache = false; }
                if (method === void 0) { method = 'GET'; }
                if (headers === void 0) { headers = undefined; }
                var self = this;
                var d = this.$q.defer();
                this.common.showLoader();
                var params = {
                    url: this.config.serverHostname + url,
                    method: method,
                    cache: cache,
                    headers: { 'Accept': 'application/json;odata=verbose' }
                };
                if (!!data) {
                    params['data'] = data;
                }
                if (!!headers) {
                    for (var p in params.headers) {
                        params.headers[p] = headers[p];
                    }
                }
                this.$http(params).then(function (response) {
                    d.resolve(response);
                }).finally(function () {
                    self.common.hideLoader();
                });
                return d.promise;
            };
            /**
            * Get list item via REST services.
            * @param uri: string
            * @param done: JQueryPromiseCallback<any>
            * @param fail?: JQueryPromiseCallback<any> = undefined
            * @param always?: JQueryPromiseCallback<any> = undefined
            * @return void
            */
            Datacontext.prototype.getSpListItems = function (siteUrl, listName, filter, select, orderby, expand, top) {
                if (filter === void 0) { filter = null; }
                if (select === void 0) { select = null; }
                if (orderby === void 0) { orderby = null; }
                if (expand === void 0) { expand = null; }
                if (top === void 0) { top = 10; }
                siteUrl = siteUrl == '/' ? '' : siteUrl;
                var self = this;
                var d = this.$q.defer();
                this.common.showLoader();
                var url = [siteUrl + '/_vti_bin/listdata.svc/' + App.SharePoint.Utils.toCamelCase(listName)];
                if (!!filter) {
                    url.push('$filter=' + filter);
                }
                if (!!select) {
                    url.push('$select=' + select);
                }
                if (!!orderby) {
                    url.push('$orderby=' + orderby);
                }
                if (!!expand) {
                    url.push('$expand=' + expand);
                }
                url.push('$top=' + top);
                this.executeRestRequest(url.join('&').replace(/\&/, '\?')).then(function (response) {
                    if (response.status != 200) {
                        d.reject(response.statusText);
                        console.warn(response);
                        return;
                    }
                    if (!!response.data.d.results) {
                        d.resolve(response.data.d.results);
                    }
                    else {
                        d.resolve(response.data.d);
                    }
                });
                return d.promise;
            };
            Datacontext.prototype.getProjects = function (siteUrl, listName, force, prevMonths) {
                if (force === void 0) { force = false; }
                if (prevMonths === void 0) { prevMonths = 6; }
                var d = this.$q.defer();
                var self = this;
                var today = new Date();
                var dateFilter = new Date(today.getFullYear(), (today.getMonth() - prevMonths), today.getDate(), 0, 0, 0).toISOString();
                var filter = 'CategoryValue ne \'Log\' and Created gt datetime\'' + dateFilter + '\'';
                var select = 'Id,Title,AssignedTo,Attachments,Priority,Status,StartDate,DueDate,OrderBy,LastTimeIn,LastTimeOut';
                var orderBy = 'PriorityValue asc,Created asc';
                var expand = 'AssignedTo,Attachments,Priority,Status';
                this.getSpListItems(siteUrl, listName, filter, select, orderBy, expand, 1000).then(function (projects) {
                    // parse all the dates
                    projects.forEach(function (p) {
                        p.Created = App.Utils.parseMsDateTicks(p.Created);
                        p.Modified = App.Utils.parseMsDateTicks(p.Modified);
                        if (!!p.LastTimeIn) {
                            p.LastTimeIn = App.Utils.parseMsDateTicks(p.LastTimeIn);
                        }
                        if (!!p.LastTimeOut) {
                            p.LastTimeOut = App.Utils.parseMsDateTicks(p.LastTimeOut);
                        }
                        if (!!p.StartDate) {
                            p.StartDate = App.Utils.parseMsDateTicks(p.StartDate);
                        }
                        if (!!p.DueDate) {
                            p.DueDate = App.Utils.parseMsDateTicks(p.DueDate);
                        }
                    });
                    d.resolve(projects);
                });
                return d.promise;
            };
            Datacontext.prototype.getProject = function (siteUrl, listName, itemId) {
                siteUrl = siteUrl == '/' ? '' : siteUrl;
                return this.executeRestRequest(siteUrl + '/_vti_bin/listdata.svc/' + App.SharePoint.Utils.toCamelCase(listName) + '(' + itemId + ')');
            };
            Datacontext.prototype.insertListItem = function (url, data) {
                if (data === void 0) { data = undefined; }
                return this.executeRestRequest(url, JSON.stringify(data), false, 'POST');
            };
            Datacontext.prototype.updateListItem = function (item, data, callback) {
                var self = this;
                // Angular's $http does not work for this!
                var $jqXhr = $.ajax({
                    url: item.__metadata.uri,
                    type: 'POST',
                    contentType: 'application/json',
                    processData: false,
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader("If-Match", item.__metadata.etag);
                        // Using MERGE so that the entire entity doesn't need to be sent over the wire. 
                        xhr.setRequestHeader("X-HTTP-Method", 'MERGE');
                    },
                    data: JSON.stringify(data)
                });
                $jqXhr.done(function (data, status, jqXhr) {
                    if (self.config.debug) {
                        console.info('Services.Datacontext.updateListItem() returned...');
                        console.info(arguments);
                    }
                    if (callback) {
                        callback(arguments);
                    }
                });
                $jqXhr.always(function () {
                    self.common.hideLoader();
                });
                $jqXhr.fail(function (jqXhr, status, error) {
                    if (callback) {
                        callback(arguments);
                    }
                    if (self.config.debug) {
                        console.warn('Error in Datacontext.updateListItem(): ' + status + ' ' + error);
                    }
                });
            };
            /**
            * Delete the list item.
            * @param model: IViewModel
            * @param callback?: Function = undefined
            * @return IPromise<any>
            */
            Datacontext.prototype.deleteListItem = function (item) {
                var headers = {
                    'Accept': 'application/json;odata=verbose',
                    'X-Http-Method': 'DELETE',
                    'If-Match': item.__metadata.etag
                };
                return this.executeRestRequest(item.__metadata.uri, null, false, 'POST', headers);
            };
            /**
            * Delete an attachment.
            * @param att: SharePoint.ISpAttachment
            * @return IPromise<any>
            */
            Datacontext.prototype.deleteAttachment = function (att) {
                var headers = {
                    'Accept': 'application/json;odata=verbose',
                    'X-HTTP-Method': 'DELETE'
                };
                return this.executeRestRequest(att.__metadata.uri, null, false, 'POST', headers);
            };
            /**
            * Execute SOAP Request
            * @param action: string
            * @param packet: string
            * @param params: Array<any>
            * @param siteUrl?: string = ''
            * @param cache: boolean? = false
            * @param service?: string = 'lists.asmx'
            * @return IPromise<any>
            */
            Datacontext.prototype.executeSoapRequest = function (action, packet, data, siteUrl, cache, headers, service) {
                if (siteUrl === void 0) { siteUrl = ''; }
                if (cache === void 0) { cache = false; }
                if (headers === void 0) { headers = undefined; }
                if (service === void 0) { service = 'lists.asmx'; }
                siteUrl = siteUrl == '/' ? '' : siteUrl;
                var d = this.$q.defer();
                var self = this;
                this.common.showLoader();
                var serviceUrl = siteUrl + '/_vti_bin/' + service;
                if (!!data) {
                    for (var i = 0; i < data.length; i++) {
                        packet = packet.replace('{' + i + '}', (data[i] == null ? '' : data[i]));
                    }
                }
                var params = {
                    url: serviceUrl,
                    data: packet,
                    method: 'POST',
                    cache: cache,
                    headers: {
                        'Content-Type': 'text/xml; charset=utf-8',
                        'SOAPAction': action
                    }
                };
                if (!!headers) {
                    for (var p in headers) {
                        params.headers[p] = headers[p];
                    }
                }
                this.$http(params).then(function (response) {
                    d.resolve(response);
                }).finally(function () {
                    self.common.hideLoader();
                });
                return d.promise;
            };
            /**
            * Update batch of list items via SOAP services.
            * @param listName: string
            * @param fields: Array<Array<any>>
            * @param isNew?: boolean = true
            * param callback?: Function = undefined
            * @param self: SPForm = undefined
            * @return void
            */
            Datacontext.prototype.updateSoapListItems = function (fields, siteUrl, listName) {
                var action = 'http://schemas.microsoft.com/sharepoint/soap/UpdateListItems';
                var packet = '<?xml version="1.0" encoding="utf-8"?>' +
                    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                    '<soap:Body>' +
                    '<UpdateListItems xmlns="http://schemas.microsoft.com/sharepoint/soap/">' +
                    '<listName>{0}</listName>' +
                    '<updates>{1}</updates>' +
                    '</UpdateListItems>' +
                    '</soap:Body>' +
                    '</soap:Envelope>';
                var batch = ["<Batch OnError='Continue'>"];
                for (var i = 0; i < fields.length; i++) {
                    batch.push("<Method ID='1' Cmd='Update'>");
                    for (var j = 0; j < fields[i].fields.length; j++) {
                        batch.push("<Field Name='" + fields[i].fields[j].name + "'>" + App.SharePoint.Utils.escapeColumnValue(fields[i].fields[j].value) + "</Field>");
                    }
                    batch.push("<Field Name='ID'>" + fields[i].Id + "</Field>");
                    batch.push("</Method>");
                }
                batch.push("</Batch>");
                packet = packet.replace(/\{0\}/, listName).replace(/\{1\}/, batch.join());
                return this.executeSoapRequest(action, packet, null, siteUrl);
            };
            Datacontext.prototype.getSoapListItems = function (siteUrl, listName, viewFields, query, cache, rowLimit) {
                if (cache === void 0) { cache = false; }
                if (rowLimit === void 0) { rowLimit = 25; }
                var packet = '<?xml version="1.0" encoding="utf-8"?>' +
                    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                    '<soap:Body>' +
                    '<GetListItems xmlns="http://schemas.microsoft.com/sharepoint/soap/">' +
                    '<listName>' + listName + '</listName>' +
                    '<query>' + query + '</query>' +
                    '<viewFields>' + viewFields + '</viewFields>' +
                    '<rowLimit>' + rowLimit + '</rowLimit>' +
                    '</GetListItems>' +
                    '</soap:Body>' +
                    '</soap:Envelope>';
                return this.executeSoapRequest('http://schemas.microsoft.com/sharepoint/soap/GetListItems', packet, null, siteUrl, cache);
            };
            Datacontext.prototype.searchPrincipals = function (term, maxResults, principalType) {
                if (maxResults === void 0) { maxResults = 10; }
                if (principalType === void 0) { principalType = 'User'; }
                var d = this.$q.defer();
                var action = 'http://schemas.microsoft.com/sharepoint/soap/SearchPrincipals';
                var params = [term, maxResults, principalType];
                var packet = '<?xml version="1.0" encoding="utf-8"?>' +
                    '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                    '<soap:Body>' +
                    '<SearchPrincipals xmlns="http://schemas.microsoft.com/sharepoint/soap/">' +
                    '<searchText>{0}</searchText>' +
                    '<maxResults>{1}</maxResults>' +
                    '<principalType>{2}</principalType>' +
                    '</SearchPrincipals>' +
                    '</soap:Body>' +
                    '</soap:Envelope>';
                this.executeSoapRequest(action, packet, params, '', true, null, 'People.asmx').then(function (response) {
                    var xmlDoc = response.data;
                    var results = [];
                    $(xmlDoc).find('PrincipalInfo').each(function (i, n) {
                        results.push({
                            AccountName: $('AccountName', n).text(),
                            UserInfoID: parseInt($('UserInfoID', n).text()),
                            DisplayName: $('DisplayName', n).text(),
                            Email: $('Email', n).text(),
                            Title: $('Title', n).text(),
                            IsResolved: $('IsResolved', n).text() == 'true' ? !0 : !1,
                            PrincipalType: $('PrincipalType', n).text()
                        });
                    });
                    d.resolve(results);
                });
                return d.promise;
            };
            Datacontext.prototype.getCurrentUser = function () {
                var d = this.$q.defer();
                var self = this;
                if (!!this.cache.currentUser) {
                    d.resolve(this.cache.currentUser);
                    return d.promise;
                }
                var user = {
                    ID: null,
                    Title: null,
                    Name: null,
                    EMail: null,
                    JobTitle: null,
                    Department: null,
                    Account: null,
                    UserName: null,
                    Office: null,
                    Groups: []
                };
                var query = '<Query><Where><Eq><FieldRef Name="ID" /><Value Type="Counter"><UserID /></Value></Eq></Where></Query>';
                var viewFields = '<ViewFields><FieldRef Name="ID" /><FieldRef Name="Name" /><FieldRef Name="EMail" /><FieldRef Name="Department" /><FieldRef Name="JobTitle" /><FieldRef Name="UserName" /><FieldRef Name="Office" /></ViewFields>';
                this.getSoapListItems('', 'User Information List', viewFields, query, true).then(function (response) {
                    var xmlDoc = response.data;
                    var $zrows = $(xmlDoc).find('*').filter(function () {
                        return this.nodeName.toLowerCase() == 'z:row';
                    });
                    $zrows.each(function () {
                        user.ID = parseInt($(this).attr('ows_ID'));
                        user.Title = $(this).attr('ows_Title');
                        user.Name = $(this).attr('ows_Name');
                        user.EMail = $(this).attr('ows_EMail');
                        user.JobTitle = $(this).attr('ows_JobTitle');
                        user.Department = $(this).attr('ows_Department');
                        user.Account = user.ID + ';#' + user.Title;
                        user.Groups = [];
                    });
                    if (!!user.Name) {
                        self.getUsersGroups(user.Name).then(function (groups) {
                            user.Groups = groups;
                            self.cache.currentUser = user;
                            d.resolve(user);
                        });
                    }
                    else {
                        self.cache.currentUser = user;
                        d.resolve(user);
                    }
                });
                return d.promise;
            };
            Datacontext.prototype.getUsersGroups = function (loginName) {
                var d = this.$q.defer();
                var packet = '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">' +
                    '<soap:Body>' +
                    '<GetGroupCollectionFromUser xmlns="http://schemas.microsoft.com/sharepoint/soap/directory/">' +
                    '<userLoginName>' + loginName + '</userLoginName>' +
                    '</GetGroupCollectionFromUser>' +
                    '</soap:Body>' +
                    '</soap:Envelope>';
                var action = 'http://schemas.microsoft.com/sharepoint/soap/directory/GetGroupCollectionFromUser';
                this.executeSoapRequest(action, packet, null, '', true, null, 'usergroup.asmx').then(function (response) {
                    var xmlDoc = response.data;
                    var $errorText = $(xmlDoc).find('errorstring');
                    // catch and handle returned error
                    if (!!$errorText && $errorText.text() != "") {
                        d.reject($errorText.text());
                        return;
                    }
                    var groups = [];
                    $(xmlDoc).find("Group").each(function (i, el) {
                        groups.push({
                            id: parseInt($(el).attr("ID")),
                            name: $(el).attr("Name")
                        });
                    });
                    d.resolve(groups);
                });
                return d.promise;
            };
            Datacontext.prototype.getProjectTotals = function (siteUrl, listName, start, end, title, projectsListName) {
                var self = this;
                var d = this.$q.defer();
                start = App.Utils.parseDate(start);
                end = App.Utils.parseDate(end);
                if (this.config.debug) {
                    console.info(start);
                    console.info(end);
                }
                // Group the time entry data by CreatedBy, Project
                var transform = function (logs) {
                    var groups = [];
                    // logs is ordered by CreatedBy.Name, ProjectId, TimeIn 
                    // 1. group by user
                    var temp = []; //temporary tracking array
                    for (var i = 0; i < logs.length; i++) {
                        var name = logs[i].CreatedBy.Name;
                        if (temp.indexOf(name) > -1) {
                            continue;
                        }
                        temp.push(name);
                        groups.push({
                            Name: name,
                            Title: title,
                            Projects: []
                        });
                    }
                    for (var i = 0; i < groups.length; i++) {
                        var group = groups[i];
                        var temp = [];
                        // 2. group by project
                        for (var j = 0; j < logs.length; j++) {
                            var p = logs[j];
                            if (p.CreatedBy.Name != group.Name || temp.indexOf(p.ProjectId) > -1) {
                                continue;
                            }
                            temp.push(p.ProjectId);
                            var proj = {
                                Id: p.ProjectId,
                                Title: p.Project.Title,
                                TotalHours: 0,
                                PersonName: p.CreatedBy.Name,
                                SiteUrl: siteUrl,
                                ListName: projectsListName,
                                Color: null
                            };
                            // 3. sum the total hours from a person's project's entries in `logs`
                            for (var k = 0; k < logs.length; k++) {
                                var log = logs[k];
                                if (log.CreatedBy.Name == group.Name && proj.Id == log.ProjectId && !!log.TimeIn && !!log.TimeOut) {
                                    proj.TotalHours += log.Hours;
                                }
                            }
                            group.Projects.push(proj);
                        }
                    }
                    d.resolve(groups);
                };
                // tested Odata query
                // /_vti_bin/listdata.svc/TimeLog?$expand=CreatedBy,Project&$orderby=CreatedBy/Name,ProjectId,TimeIn&$filter=TimeIn ge datetime'2015-12-07T05:00:00.000Z' and TimeIn le datetime'2015-12-11T05:00:00.000Z'&$select=CreatedBy/Name,ProjectId,TimeIn,TimeOut,Hours,Project/Title
                var startIso = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 0, 0, 0).toISOString();
                var endIso = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 0).toISOString();
                // get data from production server
                this.getSpListItems(
                /*siteUrl:*/ siteUrl, 
                /*listName:*/ listName, 
                /*filter:*/ 'TimeIn ne null and TimeOut ne null and TimeIn ge datetime\'' + startIso + '\' and TimeIn le datetime\'' + endIso + '\'', 
                /*select:*/ 'CreatedBy/Name,ProjectId,TimeIn,TimeOut,Hours,Project/Title', 
                /*orderby:*/ 'CreatedBy/Name,ProjectId,TimeIn', 
                /*expand:*/ 'CreatedBy,Project', 
                /*top:*/ 1000).then(transform);
                return d.promise;
            };
            Datacontext.Id = 'datacontext';
            return Datacontext;
        })();
        Services.Datacontext = Datacontext;
        // Register with angular
        App.app.factory(Datacontext.Id, ['$http', '$q', 'common', 'config', function factory($http, $q, common, config) {
                return new Datacontext($http, $q, common, config);
            }]);
    })(Services = App.Services || (App.Services = {}));
})(App || (App = {}));
var App;
(function (App) {
    var Common = (function () {
        function Common($rootScope) {
            this.$rootScope = $rootScope;
            this.$loader = $('.ajax-loader');
        }
        Common.prototype.showLoader = function () {
            this.$loader.show();
        };
        Common.prototype.hideLoader = function () {
            this.$loader.hide();
        };
        Common.Id = "common";
        return Common;
    })();
    App.Common = Common;
    App.commonModule = angular.module('common', []);
    App.commonModule.factory(Common.Id, ['$rootScope', function ($rootScope) {
            return new Common($rootScope);
        }]);
})(App || (App = {}));
var App;
(function (App) {
    // Reusable views for the Angular UI Routes
    // Alter to fit your configuration
    /**
     * Setup your SharePoint host application configurations here and in /app/dvr/Views.ts
     */
    var Config = (function () {
        function Config() {
            this.debug = false;
            this.appPath = 'app/'; //path to Angular app template files
            this.appTitle = 'Dev Projects Kanban'; //display title of the app
            this.editGroups = ['Developers', 'Testers', 'Managers']; // list of SharePoint group names allowed to save changes
            this.orgName = ''; //the name of your organization, shown in Copyright
            this.priorities = ['(1) High', '(2) Normal', '(3) Low'];
            this.serverHostname = '//' + window.location.hostname;
            this.version = '0.0.1';
            // Angular UI Routes
            this.routes = [
                // Top-level abstract route
                {
                    route: 'app',
                    showInMenu: false,
                    model: {
                        // With abstract set to true, that means this state can not be explicitly activated.
                        // It can only be implicitly activated by activating one of its children.
                        abstract: true,
                        // This abstract state will prepend '/' onto the urls of all its children.
                        url: '/',
                        // This is the top level state, so this template file will be loaded and then inserted into the ui-view within index.html.
                        templateUrl: 'app/shell/shell.htm',
                        controller: App.Controllers.ShellController.Id,
                        controllerAs: 'shell',
                        resolve: {
                            currentUser: ['datacontext', function (datacontext) {
                                    return datacontext.getCurrentUser();
                                }]
                        }
                    }
                },
                {
                    title: 'Projects',
                    showInMenu: true,
                    route: 'app.home',
                    model: {
                        // use same url as parent - '/' + '' = '/'
                        url: '',
                        // If there is more than a single ui-view in the parent template, or you would
                        // like to target a ui-view from even higher up the state tree, you can use the
                        // views object to configure multiple Views. Each view can get its own template,
                        // controller, and resolve data.
                        // View names can be relative or absolute. Relative view names do not use an '@'
                        // symbol. They always refer to views within this state's parent template.
                        // Absolute view names use a '@' symbol to distinguish the view and the state.
                        // So 'foo@bar' means the ui-view named 'foo' within the 'bar' state's template.
                        views: {
                            ////////////
                            // Main Menu
                            ////////////
                            // viewName@stateName
                            'menu@app': App.Views.menu,
                            ////////////
                            // Home
                            ////////////
                            'main@app': App.Views.projects,
                            ////////////
                            // Footer
                            ////////////
                            'footer@app': App.Views.footer
                        }
                    }
                },
                {
                    title: 'Summary',
                    showInMenu: true,
                    route: 'app.summary',
                    model: {
                        url: 'summary',
                        views: {
                            'menu@app': App.Views.menu,
                            'main@app': App.Views.summary,
                            'footer@app': App.Views.footer
                        }
                    }
                },
                {
                    route: 'app.summary.range',
                    showInMenu: false,
                    model: {
                        url: '/start/{start:[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}}/end/{end:[0-9]{4}-[0-9]{1,2}-[0-9]{1,2}}',
                        views: {
                            'menu@app': App.Views.menu,
                            'main@app': App.Views.summary,
                            'footer@app': App.Views.footer
                        }
                    }
                }
            ];
        }
        Config.Id = 'config';
        return Config;
    })();
    App.Config = Config;
    App.configModule = angular.module('config', []);
    App.configModule.factory(Config.Id, [function () {
            return new Config();
        }]);
})(App || (App = {}));
var App;
(function (App) {
    App.app.directive('kanbanTask', function () {
        return {
            restrict: 'A',
            scope: {
                kanbanTask: '=',
                parentScope: '='
            },
            link: function (scope, $element, attrs) {
                scope.$watch(function (scope) {
                    // Store in parent scope a reference to the task being dragged, 
                    // its parent column array, and its index number.
                    $element.on('dragstart', function (ev) {
                        //console.info(ev.target.id);
                        scope.parentScope.dragging = {
                            task: scope.kanbanTask,
                        };
                    });
                });
            }
        };
    });
    App.app.directive('kanbanColumn', function () {
        return {
            restrict: 'A',
            scope: {
                kanbanColumn: '=',
                parentScope: '='
            },
            link: function (scope, $element, attrs) {
                scope.$watch(function (scope) {
                    // trigger the event handler when a task element is dropped over the Kanban column.
                    $element.on('drop', function (event) {
                        cancel(event);
                        var controller = scope.parentScope;
                        var task = scope.parentScope.dragging.task;
                        var col = scope.kanbanColumn;
                        if (!!task) {
                            var field = {
                                name: 'Status',
                                value: col.status
                            };
                            task.Status.Value = col.status;
                            controller.updateTask(task.Id, field);
                            controller.dragging.task = undefined; //clear the referene so we know we're no longer dragging
                        }
                    }).on('dragover', function (event) {
                        cancel(event);
                    });
                });
                // Cross-browser method to prevent the default event when dropping an element.
                function cancel(event) {
                    if (event.preventDefault) {
                        event.preventDefault();
                    }
                    if (event.stopPropagation) {
                        event.stopPropagation();
                    }
                    return false;
                }
            }
        };
    });
    App.app.directive('datePicker', ['$window', function ($window) {
            return {
                restrict: 'A',
                scope: {
                    ngModel: '='
                },
                link: function (scope, elem, attr) {
                    // apply jQueryUI datepicker
                    $(elem)['datepicker']({
                        changeMonth: true,
                        changeYear: true
                    });
                    scope.$watch(function (scope) {
                        var d = scope.ngModel;
                        $(elem).val(moment(d).format('MM/DD/YYYY'));
                    });
                }
            };
        }]);
    App.app.directive('totalHours', ['$window', function ($window) {
            return {
                restrict: 'EA',
                scope: {
                    projects: '='
                },
                link: function (scope, elem, attr) {
                    scope.$watch(function (scope) {
                        var projects = scope.projects;
                        var total = 0;
                        for (var i = 0; i < projects.length; i++) {
                            total += projects[i].TotalHours;
                        }
                        scope.total = total;
                    });
                },
                replace: true,
                template: '<strong>{{total | number:3}}</strong>'
            };
        }]);
    //<span style="float:right;" projects-total-hours project-groups="person.ProjectGroups"></span>
    App.app.directive('projectsTotalHours', ['$window', function ($window) {
            return {
                restrict: 'EA',
                scope: {
                    projectGroups: '='
                },
                link: function (scope, elem, attr) {
                    scope.$watch(function (scope) {
                        var projectGroups = scope.projectGroups;
                        var total = 0;
                        for (var i = 0; i < projectGroups.length; i++) {
                            for (var j = 0; j < projectGroups[i].Projects.length; j++) {
                                total += projectGroups[i].Projects[j].TotalHours;
                            }
                        }
                        scope.total = total;
                    });
                },
                replace: false,
                template: 'Total Hours: {{total | number:3}}'
            };
        }]);
    App.app.directive('doughnutChart', doughnutChart);
    function doughnutChart() {
        return {
            restrict: 'A',
            scope: {
                projectsData: '='
            },
            link: function (scope, $elem, attr) {
                scope.$watch(function (scope) {
                    var projects = scope.projectsData;
                    var chartData = [];
                    var canvasId = $elem[0].id;
                    var uniqueId = 'doughnut_' + canvasId;
                    var chart;
                    var canvas = document.getElementById(canvasId);
                    var ctx = canvas.getContext("2d");
                    var colors = App.Utils.randomize(App.Utils.hexColors());
                    // destroy existing chart object
                    if (canvas['__chartRef']) {
                        chart = canvas['__chartRef'];
                        chart.clear();
                        chart.destroy();
                    }
                    if (typeof projects != 'undefined') {
                        projects.forEach(function (p, i) {
                            p.Color = p.Color || (i < colors.length ? colors[i] : colors[colors.length - i]);
                            chartData.push({
                                label: p.Id + ': ' + p.Title,
                                value: p.TotalHours.toFixed(3),
                                color: p.Color
                            });
                        });
                    }
                    //canvas['__chartRef'] = 
                    chart = new window['Chart'](ctx).Doughnut(chartData, {
                        responsive: true,
                        segmentShowStroke: true,
                        segmentStrokeColor: "#ccc",
                        segmentStrokeWidth: 1,
                        percentageInnerCutout: 50 // This is 0 for Pie charts
                        ,
                        animationSteps: 100,
                        animationEasing: "easeOutBounce",
                        animateRotate: true,
                        animateScale: false
                    });
                    canvas['__chartRef'] = chart;
                });
            }
        };
    }
})(App || (App = {}));
var App;
(function (App) {
    App.app.filter('by_prop', function () {
        App.Utils.filterByValue['$stateful'] = true; // enable function to wait on async data
        return App.Utils.filterByValue;
    });
    App.app.filter('sp_date', function () {
        function fn(val) {
            if (!!!val) {
                return val;
            }
            return App.Utils.parseDate(val).toLocaleDateString();
        }
        ;
        fn['$stateful'] = true;
        return fn;
    });
    App.app.filter('sp_datetime', function () {
        function fn(val) {
            return App.Utils.toUTCDateTime(val);
        }
        ;
        fn['$stateful'] = true;
        return fn;
    });
    App.app.filter('active_tasks', function () {
        function fn(cols) {
            var active = [];
            if (!!!cols) {
                return active;
            }
            for (var i = 0; i < cols.length; i++) {
                for (var j = 0; j < cols[i].tasks.length; j++) {
                    if (cols[i].tasks[j].LastTimeOut == null && cols[i].tasks[j].LastTimeIn != null) {
                        active.push(cols[i].tasks[j]);
                    }
                }
            }
            return active;
        }
        ;
        fn['$stateful'] = true;
        return fn;
    });
})(App || (App = {}));
var App;
(function (App) {
    var Utils = (function () {
        function Utils() {
        }
        Utils.userIsEditor = function (user, targetGroups) {
            for (var i = 0; i < targetGroups.length; i++) {
                for (var j = 0; j < user.Groups.length; j++) {
                    if (targetGroups[i] == user.Groups[j].name) {
                        return true;
                    }
                }
            }
            return false;
        };
        /**
        * Returns the index of a value in an array. Returns -1 if not found. Use for IE8 browser compatibility.
        * @param a: Array<any>
        * @param value: any
        * @return number
        */
        Utils.indexOf = function (a, value) {
            // use the native Array.indexOf method if exists
            if (!!Array.prototype.indexOf) {
                return Array.prototype.indexOf.apply(a, [value]);
            }
            for (var i = 0; i < a.length; i++) {
                if (a[i] === value) {
                    return i;
                }
            }
            return -1;
        };
        Utils.getTimestamp = function () {
            return '?_=' + new Date().getTime();
        };
        Utils.parseMsDateTicks = function (val) {
            if (val == null) {
                return val;
            }
            return new Date(parseInt(val.replace(/\D/g, '')));
        };
        Utils.toUTCDateTime = function (date) {
            if (!!!date) {
                return date;
            }
            else if (date.constructor === String) {
                date = Utils.parseMsDateTicks(date);
            }
            var m = date.getUTCMinutes(), h = date.getUTCHours(), s = date.getUTCSeconds();
            return date.toLocaleDateString()
                + ' ' + (h < 10 ? '0' + h : h)
                + ':' + (m < 10 ? '0' + m : m)
                + ':' + (s < 10 ? '0' + s : s);
        };
        /**
        * Parse dates in format: "MM/DD/YYYY", "MM-DD-YYYY", "YYYY-MM-DD", "/Date(1442769001000)/", or YYYY-MM-DDTHH:MM:SSZ
        * @param val: string
        * @return Date
        */
        Utils.parseDate = function (val) {
            if (!!!val) {
                return null;
            }
            if (typeof val == 'object' && val.constructor == Date) {
                return val;
            }
            var rxSlash = /\d{1,2}\/\d{1,2}\/\d{2,4}/, // "09/29/2015" 
            rxHyphen = /\d{1,2}-\d{1,2}-\d{2,4}/, // "09-29-2015"
            rxIsoDate = /\d{4}-\d{1,2}-\d{1,2}/, // "2015-09-29"
            rxTicks = /(\/|)\d{13}(\/|)/, // "/1442769001000/"
            rxIsoDateTime = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, tmp, m, d, y, time, date = null;
            val = rxIsoDate.test(val) ? val : (val + '').replace(/[^0-9\/\-]/g, '');
            if (val == '') {
                return null;
            }
            if (rxSlash.test(val) || rxHyphen.test(val)) {
                tmp = rxSlash.test(val) ? val.split('/') : val.split('-');
                m = parseInt(tmp[0]) - 1;
                d = parseInt(tmp[1]);
                y = parseInt(tmp[2]);
                y = y < 100 ? 2000 + y : y;
                date = new Date(y, m, d, 0, 0, 0, 0);
            }
            else if (rxIsoDate.test(val) || rxIsoDateTime.test(val)) {
                tmp = val.split('-');
                y = parseInt(tmp[0]);
                m = parseInt(tmp[1]) - 1;
                d = parseInt(tmp[2]);
                y = y < 100 ? 2000 + y : y;
                if (/T/.test(val)) {
                    time = val.split('T')[1].split(':');
                    date = new Date(y, m, d, ~~time[0], ~~time[1], ~~time[2]);
                }
                else {
                    date = new Date(y, m, d, 0, 0, 0);
                }
            }
            else if (rxTicks.test(val)) {
                date = new Date(parseInt(val.replace(/\D/g, '')));
            }
            return date;
        };
        /**
        * Filter by Property Value
        * The default Angular `filter` filter throws 'too much recursion' error when filtering a Breeze entity with relationships.
        * This is just a simple filter for a shallow property value search.
        * <p>
        * usage: <div ng-repeat="eb in vm.employeeBenefitItems | by_prop : svc.ServiceId"></div>
        *
        * @param entities Array<any>
        * @return Array<any>
        */
        Utils.filterByValue = function (entities, val) {
            if (!!!entities) {
                return [];
            }
            var filtered = [];
            for (var i = 0; i < entities.length; i++) {
                for (var prop in entities[i]) {
                    if (entities[i][prop] == val) {
                        filtered.push(entities[i]);
                    }
                }
            }
            return filtered;
        };
        /**
        * Find and return unique values from an array.
        *
        * @param inputArray:Array
        * @param keyName
        * @return Array
        */
        Utils.getUniqueKeyValues = function (inputArray, keyName) {
            var outputArray = [];
            for (var i = 0; i < inputArray.length; i++) {
                var val = inputArray[i][keyName];
                if (outputArray.indexOf(val) > -1) {
                    continue;
                }
                outputArray.push(val);
            }
            return outputArray.sort();
        };
        Utils.remove = function (a, from, to) {
            if (to === void 0) { to = undefined; }
            var rest = a.slice((to || from) + 1 || a.length);
            a.length = from < 0 ? a.length + from : from;
            return a.push.apply(a, rest);
        };
        // https://developer.mozilla.org/en-US/docs/Web/Guide/API/DOM/The_structured_clone_algorithm
        Utils.clone = function (objectToBeCloned) {
            // Basis.
            if (!(objectToBeCloned instanceof Object)) {
                return objectToBeCloned;
            }
            var objectClone;
            // Filter out special objects.
            var Constructor = objectToBeCloned.constructor;
            switch (Constructor) {
                // Implement other special objects here.
                case RegExp:
                    objectClone = new Constructor(objectToBeCloned);
                    break;
                case Date:
                    objectClone = new Constructor(objectToBeCloned.getTime());
                    break;
                default:
                    objectClone = new Constructor();
            }
            // Clone each property.
            for (var prop in objectToBeCloned) {
                objectClone[prop] = Utils.clone(objectToBeCloned[prop]);
            }
            return objectClone;
        };
        /**
         * Randomize array element order in-place.
         * Using Durstenfeld shuffle algorithm.
         */
        Utils.randomize = function (array) {
            for (var i = array.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = array[i];
                array[i] = array[j];
                array[j] = temp;
            }
            return array;
        };
        Utils.randomColor = function () {
            return '#' + Math.floor(Math.random() * 16777215).toString(16);
        };
        Utils.hexColors = function () {
            return [
                //blues: http://www.color-hex.com/color-palette/1294
                '#011f4b',
                '#03396c',
                '#005b96',
                '#6497b1',
                '#b3cde0',
                //"program catalog": http://www.color-hex.com/color-palette/894 
                '#edc951',
                '#eb6841',
                '#cc2a36',
                '#4f372d',
                '#00a0b0',
                //metro: http://www.color-hex.com/color-palette/700
                '#d11141',
                '#00b159',
                '#00aedb',
                '#f37735',
                '#ffc425',
                //cedar ridge: http://www.color-hex.com/color-palette/263
                '#bb1515',
                '#e0cda7',
                '#2a334f',
                '#6b4423',
                '#ac8f57',
                // gold: http://www.color-hex.com/color-palette/2799
                '#a67c00',
                '#bf9b30',
                '#ffbf00',
                '#ffcf40',
                '#ffdc73',
                //summertime: http://www.color-hex.com/color-palette/826
                '#e8d174',
                '#e39e54',
                '#d64d4d',
                '#4d7358',
                '#9ed670',
                //red: http://www.color-hex.com/color-palette/255'
                '#b62020',
                '#cb2424',
                '#fe2e2e',
                '#fe5757',
                '#fe8181',
                //purple: http://www.color-hex.com/color-palette/1835' 
                '#efbbff',
                '#d896ff',
                '#be29ec',
                '#800080',
                '#660066',
                // teal: http://www.color-hex.com/color-palette/309
                '#007777',
                '#006666',
                '#005555',
                '#004444',
                '#003333',
                // pastel: http://www.color-hex.com/color-palette/164
                '#1b85b8',
                '#5a5255',
                '#559e83',
                '#ae5a41',
                '#c3cb71'
            ];
        };
        return Utils;
    })();
    App.Utils = Utils;
})(App || (App = {}));
var App;
(function (App) {
    var SharePoint;
    (function (SharePoint) {
        // recreate the SP REST object for an attachment
        var SpAttachment = (function () {
            function SpAttachment(rootUrl, siteUrl, listName, itemId, fileName) {
                var entitySet = listName.replace(/\s/g, '');
                siteUrl = SharePoint.Utils.formatSubsiteUrl(siteUrl);
                var uri = rootUrl + siteUrl + "_vti_bin/listdata.svc/Attachments(EntitySet='{0}',ItemId={1},Name='{2}')";
                uri = uri.replace(/\{0\}/, entitySet).replace(/\{1\}/, itemId + '').replace(/\{2\}/, fileName);
                this.__metadata = {
                    uri: uri,
                    content_type: "application/octetstream",
                    edit_media: uri + "/$value",
                    media_etag: null,
                    media_src: rootUrl + siteUrl + "/Lists/" + listName + "/Attachments/" + itemId + "/" + fileName,
                    type: "Microsoft.SharePoint.DataService.AttachmentsItem"
                };
                this.EntitySet = entitySet;
                this.ItemId = itemId;
                this.Name = fileName;
            }
            return SpAttachment;
        })();
        SharePoint.SpAttachment = SpAttachment;
        var SpItem = (function () {
            function SpItem() {
            }
            return SpItem;
        })();
        SharePoint.SpItem = SpItem;
    })(SharePoint = App.SharePoint || (App.SharePoint = {}));
})(App || (App = {}));
var App;
(function (App) {
    var SharePoint;
    (function (SharePoint) {
        var Utils = (function () {
            function Utils() {
            }
            /**
            * Ensure site url is or ends with '/'
            * @param url: string
            * @return string
            */
            Utils.formatSubsiteUrl = function (url) {
                return !!!url ? '/' : !/\/$/.test(url) ? url + '/' : url;
            };
            /**
            * Convert a name to REST camel case format
            * @param str: string
            * @return string
            */
            Utils.toCamelCase = function (str) {
                return str.toString()
                    .replace(/\s*\b\w/g, function (x) {
                    return (x[1] || x[0]).toUpperCase();
                }).replace(/\s/g, '')
                    .replace(/\'s/, 'S')
                    .replace(/[^A-Za-z0-9\s]/g, '');
            };
            /**
            * Escape column values
            * http://dracoblue.net/dev/encodedecode-special-xml-characters-in-javascript/155/
            */
            Utils.escapeColumnValue = function (s) {
                if (typeof s === "string") {
                    return s.replace(/&(?![a-zA-Z]{1,8};)/g, "&amp;");
                }
                else {
                    return s;
                }
            };
            Utils.openSpForm = function (url, title, callback, width, height) {
                if (title === void 0) { title = "Project Item"; }
                if (callback === void 0) { callback = function () { }; }
                if (width === void 0) { width = 300; }
                if (height === void 0) { height = 400; }
                var ex = window["ExecuteOrDelayUntilScriptLoaded"];
                var SP = window["SP"];
                ex(function () {
                    SP.UI.ModalDialog.showModalDialog({
                        title: title,
                        showClose: true,
                        url: url,
                        dialogReturnValueCallback: callback
                    });
                }, "sp.js");
                return false;
            };
            Utils.openSpDisplayForm = function (siteUrl, listName, item, isEdit, callback) {
                if (isEdit === void 0) { isEdit = false; }
                if (callback === void 0) { callback = function () { }; }
                var itemUrl = siteUrl + '/Lists/' + listName.replace(/\s/g, '%20') + '/' + (isEdit ? 'Edit' : 'Disp') + 'Form.aspx?ID=' + item.Id;
                SharePoint.Utils.openSpForm(itemUrl, item.Title, callback);
                return false;
            };
            Utils.openSpNewForm = function (siteUrl, listName, title, callback) {
                if (title === void 0) { title = 'New Item'; }
                if (callback === void 0) { callback = function () { }; }
                var url = siteUrl + '/Lists/' + listName.replace(/\s/g, '%20') + '/NewForm.aspx';
                SharePoint.Utils.openSpForm(url, title, callback);
                return false;
            };
            return Utils;
        })();
        SharePoint.Utils = Utils;
    })(SharePoint = App.SharePoint || (App.SharePoint = {}));
})(App || (App = {}));
var App;
(function (App) {
    var Controllers;
    (function (Controllers) {
        var ShellController = (function () {
            function ShellController($rootScope, config, currentUser) {
                this.$rootScope = $rootScope;
                this.config = config;
                this.currentUser = currentUser;
            }
            ShellController.Id = 'shellController';
            ShellController.$inject = ['$rootScope', 'config', 'currentUser'];
            return ShellController;
        })();
        Controllers.ShellController = ShellController;
        // Register with angular
        App.app.controller(ShellController.Id, ShellController);
    })(Controllers = App.Controllers || (App.Controllers = {}));
})(App || (App = {}));
