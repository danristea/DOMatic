# DOMatic

DOMatic is a lightweight javascript client-side MVC framework that uses JsonML syntax and virtual DOM diffing. Its goal is to create fast UI components with minimal hard syntax.

# Components

A component is essentially an object with a controller/view pair of function properties.
The controller function should return an object, and the view function should return JsonML.

simple component:

    var app = {
      controller: function(options) {
        return {time: options.time}
      },
      view: function(ctrl) {
        return ["div", "component mounted at : " + ctrl.time]
      }
    }
Mounting the base component can be achieved calling UI.mount like so:

UI.mount(app, document.body, initobj)

where “app” is the component object, “document.body” is the DOM element where the view is to be mounted, and “initobj” is an optional object passed during instantiation.

# Nested components

Components can be nested by including another component object into the view, with the controller referencing an already instantiated controller.

child component:

    var child = {
        controller: function () {
            return this
        },
        view: function(ctrl) {
            return ["div", " child component "]
        }
    }

parent component:

    var parent = {
        controller: function () {
            this.child = new child.controller() //instantiation of the child controller
            return this
        },
        view: function(ctrl) {
            return ["div", {controller: ctrl.child, view: child.view}, " parent component "] //using ctrl.child reference to the instantiated child controller
        }
    }
    
Using unique references of previously instantiated controllers allows for component identification in the event of identical components (widgets) and allows for sorting with no unnecessary hard syntax.

# Rendering

Rendering is automatically performed during the initial mount. Nested components are also automatically rendered the first time, as long as their corresponding cache does not yet exist.
Subsequent rendering can be achieved by passing the references to the controllers coupled with the corresponding views that need updating.
This provides full control over rendering as you decide when and which components should update their corresponding views.

Examples:

UI.redraw()  //renders all components

UI.redraw(obj) //renders the component associated with the instantiated controller obj

UI.redraw([obj1, obj2, obj3]) //renders the 3 objects of the passed array

Full example

    var data = ["project A", "project B", "project C"];
    var storage = {
        data: "empty"
    }

    var table = {}
    table.controller = function() {
        this.thead = "thead"
        this.tbody = "tbody"
        this.getData = function(fn) {
            setTimeout(function() {
                storage.data = data
                fn()
            }, 2000)
        }
        return this
    }
    table.view = function(ctrl) {
        var tbody = function() {
            if (typeof storage.data === "string") return ["tr", ["td", storage.data]]
            else return ["tr", storage.data.map(function(val) {
                return ["td", val]
            })]
        }
        return [
            ["thead", ["tr", ["th", "Priority 1"],
                [["th", "Priority 2"],
                ["th", "Priority 3"]]
            ]],
            ["tbody", tbody()]
        ]
    }

    var app = {}
    app.controller = function(arg) {
        var _this = this
        this.table = new table.controller()
        this.status = arg.status
        this.date = arg.date
        this.loadedAt = "N/A"
        this.swap = function() {
            if (Array.isArray(storage.data)) {
                var last = storage.data.pop()
                storage.data.push(storage.data.shift())
                storage.data.unshift(last)
                UI.redraw(_this.table)
            } else alert("Nothing to swap, load data first.")
        }
        this.load = function() {
            _this.status = "loading... "
            _this.table.getData(function() {
                _this.status = "loaded"
                _this.loadedAt = new Date().toString()
                UI.redraw([_this, _this.table])
                //UI.redraw()
            })
            UI.redraw(_this)
        }
        return this
    }
    app.view = function(ctrl) {
        return [
            ["h1", "Main App"],
            ["div", "Started At : ", ctrl.date],
            ["hr"],
            ["div", ["button", {"onclick": ctrl.load}, "Load"],
                ["div", "Status : ", ctrl.status],
                ["div", "Last loaded : ", ctrl.loadedAt],
                ["button", {"onclick": ctrl.swap}, "Swap"],
                ["table", {controller: ctrl.table, view: table.view }]
            ]
        ]
    }

    var initobj = {
        status: "ready",
        date: new Date().toString()
    }

    window.onload = function () {
        UI.mount(app, document.body, initobj)
    }
