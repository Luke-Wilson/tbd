import React, { Component } from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router'
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';

import * as actionCreators from '../core/actions/actionCreators';
import * as dialogActions from '../core/actions/dialog';
import * as tradeActions from '../core/actions/trade';
import { TeamManagerWrapper } from './../components/componentIndex';

class TeamManager extends Component {
  constructor(props) {
    super(props);
  }

  componentWillMount() {
    this.props.getAllTeams();
    this.props.getAllProjects();
    this.props.getTrades();
  }

  handleRowClick(teamId) {
    this.props.history.push(`/dashboard/teamManager/${teamId}`)
  }

  render() {
    return (
      <TeamManagerWrapper
        openAddTeamBox={this.props.openAddTeamDialog}
      >
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell>Filled</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {this.props.teams.allTeams.map(team => {
              return (
                <TableRow key={team.identity} onClick={()=>{this.handleRowClick(team.identity)}} >
                  <TableCell>{team.properties.name}</TableCell>
                  <TableCell>{team.properties.projectName}</TableCell>
                  <TableCell>{team.properties.startDate}</TableCell>
                  <TableCell>{team.properties.endDate}</TableCell>
                  <TableCell>3/34</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TeamManagerWrapper>
    )
  }
}

function mapStateToProps({projects, teams}) {
  return {projects, teams}
}

function mapDispatchToProps(dispatch) {
  return {
    openAddTeamDialog: () => dispatch(dialogActions.openDialog('ADD_TEAM')),
    getAllTeams: () => dispatch(actionCreators.getAllTeams()),
    getAllProjects: () => dispatch(actionCreators.getAllProjects()),
    getTrades: () => dispatch(tradeActions.getTrades())
  }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(TeamManager))
