const neo4j = require('neo4j-driver').v1;
const _ = require('lodash');
const stringifyObject = require('stringify-object');
const {
  contractorHasNecessaryProps,
  extractNodes,
  newExtractNodes,
  buildNodeShape,
  extractRows,
  extractNodesWithRelatedNodes,
  mapTypeToQuery,
  createSetChain,
} = require('./databaseUtilities');
const { startUpScript, massDelete } = require('./startUpCypherScript')

class GraphApi {
  constructor(username, password, connection) {
    this.driver = neo4j.driver(connection, neo4j.auth.basic(username, password));

    // const session = this.driver.session();
    // session
    //   .run(massDelete)
    //   .then(result => {
    //     return session
    //       .run(startUpScript)
    //   })
    //   .then(result => {
    //     console.log('==== DATABASE WAS DELETED AND RESET ====')
    //   })
  }

  closeDriver() {
    this.driver.close();
  }

  getNodeById(id) {
    const session = this.driver.session();
    return session
      .run(`MATCH (n) where id(n) = ${id} RETURN n`)
      .then(result => {
        const { records } = result;
        return newExtractNodes(records);
      })
  }

  createLocation(reqBody) {
    const {locationName, companyId} = reqBody;
    const session = this.driver.session();
    return session
      .run(`
        MATCH (c:Company) where id(c) = ${companyId}
        MERGE (l:Location {name: $locationName})
        CREATE UNIQUE (c)-[r:HAS_LOCATION]->(l)
        RETURN l,c
      `, {locationName})
      .then(result => {
        const { records } = result;
        return newExtractNodes(records);
      })
  }

  createContractor(emplObj) {
    const session = this.driver.session();
    const sub = emplObj.sub
    const setProperties = createSetChain(emplObj);
    return session
      .run(`
        MERGE (n:Contractor { sub: "${sub}"})
        ${setProperties}
        RETURN n
      `)
      .then(result => {
        const { records } = result;
        return newExtractNodes(records);
      })
  }

  deleteNode(identity) {
    const session = this.driver.session();

    return session
      .run(`
        MATCH (n) WHERE ID(n) = ${identity}
        DETACH DELETE n
      `)
      .then(result => {
        session.close()
        return result
      })
  }

  updateContractor(emplObj) {
    const properties = JSON.parse(emplObj.properties)
    const updatedProperties = Object.keys(properties).map(property => {
      const value = properties[property]
      return `SET n.${property} = "${value}" `
    })

    const session = this.driver.session();
    return session
      .run(`
        MATCH (n:Contractor) WHERE id(n) = ${emplObj.identity}
        ${updatedProperties.join('')}
        return n
      `)
      .then(result => {
        const { records } = result;
        return newExtractNodes(records);
      })
  }

  getContractorByEmail(email) {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (c:Contractor ${stringifyObject({email})})
        RETURN c
      `)
      .then(({records}) => {
        session.close()
        if (_.isEmpty(records[0])) {
          return null
        } else {
          return newExtractNodes(records);
        }
      });
  }

  getParentNodeList(queryString, label) {
    // TODO: update this method to match new schema
    const session = this.driver.session();
    return session
      .run(`
        MATCH (s:${label})
        WHERE s.name =~ '(?i)${queryString}.*'
        RETURN s
      `)
      .then(({ records }) => extractNodes(records))
      .then(nodes => nodes.map(node => node.properties.name))
  }

  getContractorSkills(identity) {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (c:Contractor) WHERE ID(c) = ${identity}
        MATCH (c)-[:HAS_SKILL]->(skill)
        RETURN skill
      `)
      .then(({records}) => {
        return extractNodes(records);
      })
      .catch(err => {
        console.error(err);
      })
  }

  addSkillToContractor(identity, skill) {
    // TODO: Debug this issue.
    const session = this.driver.session();

    return session
      .run(`
        MATCH (c:Contractor) WHERE ID(c) = ${identity}
        MATCH (skill:Skill { name: "${skill.name}" })
        CREATE UNIQUE (c)-[:HAS_SKILL]->(skill)
        RETURN c,skill
      `)
      .then(({ records }) => {
        session.close();
        return newExtractNodes(records);
      })
      .catch(err => {
        console.error(err)
      })
  }

  getContractorCertifications(identity) {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (c:Contractor) WHERE ID(c) = ${identity}
        MATCH (c)-[:HAS_CERTIFICATION]->(cert)
        RETURN cert
      `)
      .then(({records}) => {
        session.close();
        return extractNodes(records);
      })
      .catch(err => {
        console.error(err);
      })
  }

  addContractorCertification(identity, certification) {
    // TODO: update this method to match new schema
    const session = this.driver.session();
    return session
      .run(`
        MATCH (c:Contractor) WHERE ID(c) = ${identity}
        MATCH (parentCert:Certification { name: "${certification.name}" })
        CREATE (cert:CertificationInstance ${stringifyObject(certification)})-[:INSTANCE_OF]->(parentCert),
        (c)-[:HAS_CERTIFICATION_INSTANCE]->(cert)
        RETURN cert
      `)
      .then((result) => {
        const { records } = result;
        session.close();
        return extractNodes(records);
      })
      .catch(err => {
        console.error(err)
      })
  }

  getTeamById({ teamId }) {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (t:Team) WHERE id(t) = ${teamId}
        OPTIONAL MATCH (proj:Project)-[]-(t)
        OPTIONAL MATCH (l:Location)-[]-(proj)
        OPTIONAL MATCH (r:Role)-[]-(t)
        OPTIONAL MATCH (sk:SkillLevel)-[]-(r)
        OPTIONAL MATCH (tr:Trade)-[]-(sk)
        OPTIONAL MATCH (pos:Position)-[]-(r)
        OPTIONAL MATCH (cont:Contractor)-[]-(pos)
        RETURN t,l,proj,r,tr,sk,pos,cont
      `)
      .then(result => {
        const { records } = result;
        session.close();
        return newExtractNodes(records);
      })
      .catch(err => console.error(err));
  }

  // This method builds an individual element for the getTeams array.
  getTeamAsElement({ teamId }) {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (t:Team) WHERE id(t) = ${teamId}
        OPTIONAL MATCH (proj:Project)-[]-(t)
        OPTIONAL MATCH (pos:Position)-[]-(:Role)-[]-(t)
        RETURN t,proj,pos
      `)
      .then(result => {
        const { records } = result;
        session.close();

        const response = {};
        let projectNode;

        _.forEach(records, ele => {
          _.forEach(ele._fields, field => {
            if (field) {
              if (field.labels[0] === 'Team') {
                Object.assign(response, buildNodeShape(field));
              } else if (field.labels[0] === 'Project') {
                projectNode = buildNodeShape(field);
                response.projectId = projectNode.id;
              }
            }
          })
        })
        response.filledPositions = '33' // I'm not sure how we're going to calculate this.
        response.totalPositions = '44' // I'm not sure how we're going to calculate this.
        return response;
      })
      .catch(err => console.error(err));
  }

  getTeams() {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (t:Team)
        RETURN t
      `)
      .then(result => {
        session.close();
        const { records } = result;
        const promiseArray = records.map(ele => {
          let teamId = ele._fields[0].identity.low;
          return this.getTeamAsElement({teamId: teamId})
        })
        return Promise.all(promiseArray)
          .then(r => r)
      })
      .catch(err => console.error(err));
  }

  createTeam(reqBody) {
    const { teamName, projectId, startDate, endDate } = reqBody;

    const session = this.driver.session();
    return session
      .run(`
        MATCH (project:Project) where id(project) = ${projectId}
        CREATE (team:Team {
          name: $teamName,
          startDate: $startDate,
          endDate: $endDate,
          created_at: '${new Date()}'
        })-[:TEAM_FOR]->(project)
        RETURN team
      `, {teamName, startDate, endDate})
      .then(result => {
        const { records } = result;
        session.close();
        return records.length
          ? extractNodes(records)
          : {"error": "An error occurred. This team was not created."};
      })
      .catch(err => {
        console.error(err)
      });
  }

  createProject(reqBody) {
    const { projectName, locationId } = reqBody;

    const session = this.driver.session();
    return session
      .run(`
        MATCH (location:Location) where id(location) = ${locationId}
        CREATE (project:Project {name: $projectName, created_at: '${new Date()}'})-[:PROJECT_AT]->(location)
        RETURN project
      `, {projectName})
      .then(result => {
        const { records } = result;
        session.close();
        return records.length
          ? extractNodes(records)
          : {"error": "An error occurred. This team was not created."};
      })
      .catch(err => {
        console.error(err)
      });
  }

  getProject(reqQuery) {
    const { projectId } = reqQuery;
    const session = this.driver.session();
    return session
      .run(`
        MATCH (proj:Project) WHERE ID(proj) = ${projectId}
        OPTIONAL MATCH (t:Team)-[]-(proj)
        OPTIONAL MATCH (l:Location)-[]-(proj)
        RETURN proj,l,t
      `)
      .then(result => {
        const { records } = result;
        session.close();
        return newExtractNodes(records);
      })
      .catch(err => console.error(err));
  }

  getProjects() {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (p:Project)
        RETURN p
      `)
      .then(result => {
        const { records } = result;
        session.close();
        return extractNodes(records);
      })
      .catch(err => console.error(err));
  }

  updateNode(id, properties) {
    const session = this.driver.session();
    const updatedProperties = createSetChain(properties)
    return session
      .run(`
        MATCH (n) WHERE id(n) = ${id}
        ${updatedProperties}
        RETURN n
      `)
      .then(result => {
        session.close();
        return this.getNodeById(id)
      })
      .then(result => {
        return result
      })
  }

  getTeamRoles(teamId) {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (t:Team) WHERE ID(t) = ${teamId}
        MATCH (t)-[:HAS_ROLE]->(r)
        RETURN t,r
      `)
      .then(({ records }) => {
        session.close()
        return newExtractNodes(records)
      })
  }

  createRole(role) {
    const {
      teamId,
      name,
      totalPositions,
      description,
      rate,
      skillLevel,
    } = _.mapValues(role, (value) => !isNaN(value) ? parseInt(value) : value);

    const session = this.driver.session();
    let createPositionNodesSegment = "";
    for (let i = 0; i < totalPositions; i++) {
      createPositionNodesSegment += `CREATE (pos${i}:Position {status: 'unfilled', name: '${name} position'})-[:IS_POSITION_FOR]->(r)\n `
    }

    return session
      .run(`
        MATCH (t:Team) WHERE ID(t) = ${teamId}
        CREATE (r:Role {
          created_at: '${new Date()}',
          name: $name,
          totalPositions: $totalPositions,
          description: $description,
          rate: $rate,
          skillLevel: $skillLevel
        })
        CREATE UNIQUE (t)-[:HAS_ROLE]->(r)
        ${createPositionNodesSegment}
        RETURN r,t
      `, { name, totalPositions, description, rate, skillLevel })
      .then( ({ records }) => {
        session.close()
        return newExtractNodes(records);
      });
  }

  addContractorToPosition(contractorId, positionId) {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (p:Position) WHERE ID(p) = ${positionId}
        MATCH (c:Contractor) WHERE ID(c) = ${contractorId}
        SET p.status = 'filled'
        CREATE UNIQUE (p)<-[:HAS_POSITION]-(c)
        RETURN p,c
      `)
      .then( ({ records }) => {
        session.close()
        return newExtractNodes(records)
      });
  }

  removeContractorFromPosition(contractorId, positionId) {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (p:Position) WHERE ID(p) = ${positionId}
        MATCH (c:Contractor) WHERE ID(c) = ${contractorId}
        OPTIONAL MATCH (p)<-[rel:HAS_POSITION]-(c)
        SET p.status = 'unfilled'
        DELETE rel
        RETURN p
      `)
      .then( ({ records }) => {
        session.close()
        return extractNodes(records)
      });
  }

  getContractorsByRole(roleId) {
    const session = this.driver.session();
    return session
      .run(`
        MATCH (r:Role) WHERE ID(r) = ${roleId}
        OPTIONAL MATCH (r)<-[:IS_POSITION_FOR]-(p:Position)<-[:HAS_POSITION]-(c:Contractor)
        RETURN c
      `)
      .then( ({ records }) => {
        session.close()
        return extractNodes(records)
      });
  }

}

module.exports = GraphApi;
