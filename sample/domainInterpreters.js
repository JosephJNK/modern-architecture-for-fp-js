"use strict";

// Interpreters to get this example to work. Most of these are just sketches
// of functionality to show how the interfaces and responsibilities will look

var makeInterpreter = require("../").makeInterpreter,
    builtInAlgebras = require("../").algebras,
    impure = builtInAlgebras.impure,
    result = builtInAlgebras.returning;

var algebras = require("./algebras");

var inspect = require("util").inspect;

var authorization = makeInterpreter("authorization", {
  isValidToken: function (args) {
    var token = args.token;
    console.log("executed isValidToken");

    // Pretend I'm checking a signature here
    return result(token.isValid === true);
  },
  isAuthed: function (args) {
    var userId = args.userId,
        token = args.token;

    console.log("executed isAuthed");

    return result(token && token.userId === userId);
  },
  doesTokenMatchUserId: function (args) {
    var userId = args.userId,
        token = args.token;

    return result(token && token.userId === userId);
  }
});

// Overwrite replaces the remainder of this composite's program with the provided instruction list
var errors = makeInterpreter("errors", {
  authorization: function (args, overwrite) {
    var identity = args.identity,
        requestedResource = args.requestedResource,
        message = "User " + identity + " does not have access to resource " + requestedResource;

    // An algebra whose interpreter is constantly defined as exiting the current composite
    // and returning the value it was instantiated with as the composite's response
    overwrite([result({
      status: 401,
      body: message
    })]);
  },
  internalServer: function (args, overwrite) {
    var message = args.sourceError;

    // I'm not sold that returning http errors is best here... I think there may be a more
    // composable solution, based on returning general error codes and later mapping them
    // to response codes, but I'm not gonna obsess over it ATM. This sounds like an orthogonal problem
    // to the one this library is solving.
    overwrite([result({
      status: 500,
      body: message
    })]);
  }
});

var userRecords = makeInterpreter("userRecords", {
  updateField: function (args) {
    var entityId = args.entityId,
        fieldName = args.fieldName,
        fieldValue = args.fieldValue,
        upsertPayload = {};

    upsertPayload[fieldName] = fieldValue;

    return algebras.database.upsert("users", entityId, upsertPayload);
  }
});

var database = makeInterpreter("coconutDb/dbOperations", {
  upsert: function (args, cb) {
    var tableName = args.table,
        entityId = args.id,
        updatedField = args.patch,
        field = Object.keys(updatedField)[0],
        value = updatedField[field];

    console.log("upsert is returning a impure operation now");
    return impure(function (cb) {
      // This is where we would interface with an actual DB driver
      console.log("operating on the database: UPSERT " + field + " = " + value + " WHERE id = " + entityId);
      cb();
    });
  }
});

var logging = makeInterpreter("log", {
  log: function (args, cb) {
    var message = args.message;

    return impure(function (cb) {
      console.log("LOG: " + message);
    });
  },
  warn: function (args, cb) {
    var message = args.message;

    return impure(function (cb) {
      console.log("WARN: " + message);
    });
  },
  error: function (args, cb) {
    var message = args.message;

    return impure(function (cb) {
      console.log("ERROR: " + message);
      cb();
    });
  }
});

var apiResponses = makeInterpreter("someRestFramework/respond", {
  respond: function (args, cb) {
    var result = args.responseDescriptor,
        responseObj = args.frameworkResponseObject;

    return impure(function (cb) {
      console.log("Calling response.send with argument: " + inspect(result, { depth: null }));
      cb();
    });
  }
});

module.exports = {
  authorization: authorization,
  errors: errors,
  userRecords: userRecords,
  apiResponses: apiResponses,
  logging: logging,
  "coconutDb/dbOperations": database
};

