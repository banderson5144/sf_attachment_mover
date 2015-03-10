//var module = require("module");

var trgtQs = [
  {
    type:"list",
    name:"trgtEnv",
    message: "What environment are you inserting to:",
    choices: ['Production','Sandbox']
  },
  {
    type: "input",
    name: "trgtun",
    message: "Target Username",
    default: "bryan@mydevbox.com"
  },
  {
    type: "password",
    name: "trgtpw",
    message: "Target password (security token if necessary)",
    default: "!Th1s1sas3cr3t!"
  }
];

var insQs = [
  {
    type:"list",
    name:"insertType",
    message: "How will you be inserting attachments",
    choices: [
      {
        //key: "y",
        name: "Local CSV File",
        value: "csv"
      },
      {
        //key: "a",
        name: "Org Migration",
        value: "query"
      }
    ]
  }
];

var srcQs = [
  {
    type:"list",
    name:"srcEnv",
    message: "What environment are you migrating from:",
    choices: ['Production','Sandbox']
  },
  {
    type: "input",
    name: "srcun",
    message: "Source Username",
    default: "bryan@mydevbox.com"
  },
  {
    type: "password",
    name: "srcpw",
    message: "Source password (security token if necessary)",
    default: "!Th1s1sas3cr3t!"
  },
  {
    type:"input",
    name:"srcObj",
    message: "Please specify Object API name to get Attachments from"
  },
  {
    type:"input",
    name:"extIdFld",
    message: "Please specify the External Id field to lookup on in Target Org"
  }
];


exports.tQs = trgtQs;
exports.iQs = insQs;
exports.sQs = srcQs;
