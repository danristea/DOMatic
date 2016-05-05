(function(window) {
    "use strict"

    var UI = {
        version: "v0.0.1"
    }

    function forEach(list, f) {
        for (var i = 0; i < list.length && !f(list[i], i++);) {}
    }

    var ctrl
    var cache = []
    var controllers = []
    var views = []
    var roots = []

    // function that returns the cache associated with a controller
    function getCache(controller) {
        return cache[controllers.indexOf(controller)]
    }

    // function that returns the next defined node in list starting from 0 or spefific position,
    // resolving through nested nodes when a controller object is found
    function findNode(list, i) {
        for (var l = list.length, i = i || 0; i < l; i++) {
            if (list[i] && list[i].node) return list[i].node
            if (list[i] && list[i].controller) {
                var cache = getCache(list[i].controller)
                return cache.node || findNode(cache.children)
            }
        }
        return null
    }

    // function that removes a controller's associated component and its nested components from cache and dom
    function removeComponent(controller) {
        var index = controllers.indexOf(controller)
        for (var i = 0, l = cache[index].children.length; i < l; i++) {
            if (cache[index].children[i].controller) {
                removeComponent(cache[index].children[i].controller)
                continue
            }
            if (cache[index].children[i].node && cache[index].children[i].node.parentNode) {
                cache[index].children[i].node.parentNode.removeChild(cache[index].children[i].node)
            }
            if (cache[index].children[i].children) {
                while (cache[index].children[i].children.length > 0) {
                    cache[index].children.push(cache[index].children[i].children.pop())
                }
                delete cache[index].children[i].children
                l = cache[index].children.length
                i--
            }
        }
        if (cache[index].node) cache[index].node.parentNode.removeChild(cache[index].node)
        cache.splice(index, 1)
        controllers.splice(index, 1)
        views.splice(index, 1)
        roots.splice(index, 1)
    }

    UI.mount = function(component, element, options) {
        if (typeof component.controller !== 'function') {
            throw new Error("component.controller not a function")
            return
        }
        if (typeof element === 'undefined') {
            throw new Error("cannot mount on undefined element")
            return
        }
        if (element == null && controllers[0] instanceof component.controller) {
            removeComponent(controller)
            return
        }
        if (controllers[0]) removeComponent(controllers[0])
        ctrl = new component.controller(options)
        mount({controller: ctrl, view: component.view}, element, null)
    };

    function mount(component, element, boundingNode) {
        var index = controllers.indexOf(component.controller)
        if (index > -1) {
            if (component.view.toString() !== views[index].toString()) views[index] = component.view
            return
        }
        cache.push({})
        controllers.push(component.controller)
        views.push(component.view)
        roots.push(element)

        UI.redraw = function(controller) {
            if(typeof arguments[0] === 'undefined') arguments[0] = controllers
            else if (!Array.isArray(arguments[0])) arguments[0] = [arguments[0]]
            forEach(arguments[0], function(controller) {
                var index = controllers.indexOf(controller)
                if (index == -1) return
                if (cache[index].node) boundingNode = cache[index].node.nextSibling
                else if (cache[index].children) boundingNode = findNode(cache[index].children, cache[index].children.length - 1).nextSibling
                build(roots[index], views[index](ctrl), cache[index], boundingNode)
            })
        }
        UI.redraw(component.controller)
    }

    // recursive function that builds DOM structure
    // it works by comparing `data` with `cache`, and applies the diff to `element`
    //
    // @param {Element} element - The parent DOM element of the structure
    // @param {Array} data - JsonML data that is converted to DOM and built on `element`
    // @param {Object} cache - Object tree used to keep state in order to minimize inserts/removes

    function build(element, data, cache, boundingNode) {
        if (typeof data[0] === 'string') {
            if (cache.node) {
                if (cache.node.tagName.toLowerCase() == data[0]) element = cache.node
                else {
                    element = document.createElement(data[0])
                    cache.node.parentNode.replaceChild(element, cache.node)
                    updateAttributes({}, cache)
                    cache.node = element
                }
            } else element = cache.node = element.insertBefore(document.createElement(data[0]), boundingNode)
            boundingNode = null
            data.shift()
            var attributes = (Object.prototype.toString.call(data[0]) === "[object Object]" && !data[0].controller) ? data.shift() : {}
            updateAttributes(attributes, cache)
        } else if (cache.node) {
            cache.node.parentNode.removeChild(cache.node)
            updateAttributes({}, cache)
            delete cache.attrs
            delete cache.node
        }
        flattenArray(data)
        cleanCache(data, cache)
        createChildren(element, data, cache, boundingNode)
    }

    function updateAttributes(attributes, cache) {
        cache.attrs = cache.attrs || {}
        forEach(Object.keys(cache.attrs), function(key) {
            if (!attributes[key]) {
                if (key == 'class' && cache.node.getAttribute('className')) cache.node.removeAttribute('className')
                else cache.node.removeAttribute(key)
                delete cache.attrs[key]
            }
        })
        forEach(Object.keys(attributes), function(key) {
            if (key.substring(0, 2) == 'on') {
                cache.attrs[key] = cache.attrs[key] || Function
                if (cache.attrs[key].toString() !== attributes[key].toString()) {
                    cache.attrs[key] = cache.node[key] = attributes[key]
                }
            } else if (attributes[key] !== cache.attrs[key]) {
                if (key == 'class' || key == 'className') cache.node.className = attributes[key]
                else if (key == 'style') {
                    forEach(Object.keys(attributes[key]), function(property) {
                        cache.node.style[property] = attributes[key][property]
                    })
                } else cache.node[key] = attributes[key]
                cache.attrs[key] = attributes[key]
            }
        })
    }

    function cleanCache(data, cache) {
        var children = []
        var diffData = data.slice(0)
        cache.children = cache.children || []
        forEach(cache.children, function(child, index) {
            var found
            for (var i = 0, l = diffData.length; i < l; i++) {
                if ((typeof diffData[i] === 'string' && child.node && child.node.nodeValue && child.node.nodeValue == diffData[i]) ||
                    (Array.isArray(diffData[i]) && child.node && child.node.tagName && child.node.tagName.toLowerCase() == diffData[i][0]) ||
                    (Object.prototype.toString.call(diffData[i]) === "[object Object]" && child.controller && child.controller == diffData[i].controller)) {
                    children[i] = diffData[i] = child
                    found = true
                    var nextNode = findNode(children, i + 1)
                    if (nextNode) {
                        if (child.node) child.node.parentNode.insertBefore(child.node, nextNode)
                        else if (child.controller) {
                            var componentCache = getCache(child.controller)
                            if (componentCache.node) componentCache.node.parentNode.insertBefore(componentCache.node, nextNode)
                            else {
                                var fragment = document.createDocumentFragment()
                                forEach(componentCache.children, function(obj) {
                                    fragment.appendChild(obj.node)
                                })
                                element.insertBefore(fragment, nextNode)
                            }
                        }
                    }
                    break
                }
            }
            if (!found) {
                if (child.controller) removeComponent(child.controller)
                else if (child.node) child.node.parentNode.removeChild(child.node)
            }
        })
        cache.children = children
    }

    function createChildren (element, data, cache, boundingNode) {
        for (var i = 0, l = data.length; i < l; i++) {
            cache.children[i] = cache.children[i] || {};
            if (Array.isArray(data[i])) {
                if (!cache.children[i].node) {
                    cache.children[i] = {"node": document.createElement(data[i][0])};
                    element.insertBefore(cache.children[i].node, findNode(cache.children, i+1) || boundingNode)
                }
                build(element, data[i], cache.children[i], findNode(cache.children, i+1) || boundingNode);
            } else if (typeof data[i] === 'string') {
                if (!cache.children[i].node || cache.children[i].node.nodeValue !== data[i]) {
                    cache.children[i] = {"node": document.createTextNode(data[i])};
                    element.insertBefore(cache.children[i].node, findNode(cache.children, i+1) || boundingNode);
                };
            } else {
                cache.children[i] = data[i];
                mount(data[i], element, findNode(cache.children, i+1) || boundingNode)
            }
        }
    }

    function flattenArray(data) {
        for (var i = 0, l = data.length; i < l; i++) {
            if (Array.isArray(data[i]) && typeof data[i][0] !== 'string') {
                var fragment = data.splice(i, 1)[0]
                for (var index = fragment.length; index--;) data.splice(i, 0, fragment[index])
                l = data.length
                i--
            }
        }
    }
    
    window.UI = window.UI || UI
}(typeof window !== 'undefined' ? window : this));
