import React, { Component } from 'react'

//React Router resources
import { Link } from 'react-router-dom'
import { Route } from 'react-router'

//Redux Resources
import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { withRouter } from 'react-router'

//Actions
import * as actionCreators from '../redux/actions/actionCreators'

//Components
import {
  ProfileSideCard,
  ProfileCertifications,
  ProfileSkills,
} from './../components/componentIndex'

//Containers
import { 
  ProfileSkillCard,
} from './containerIndex'

//Assets
import fbLogo from '../assets/fbLogo.png'
import lnLogo from '../assets/lnLogo.png'

class Profile extends Component {
  constructor(props) {
    super(props);
  }
  
  render() {
    const { picture, name, given_name } = this.props;
    return (
      <div>
        <div className="section row">
          <ProfileSideCard
            picture={picture}
            name={name}
          />
          <div className="col s5">
            Placeholder for Calendar
            <p>
            <button className="waves-effect waves-light btn center margin-bottom"> Book </button>
            </p>
          </div>
        </div>
        <div className ="section row">
          <ProfileSkillCard />
          <div className="divider"></div>



          <div className="divider"></div>


        </div>
      </div>

    )
  }
}

function mapStateToProps(state) {
  const { properties } = state.user;
  return { ...properties }
}

function mapDispatchToProps(dispatch) {
  return bindActionCreators(actionCreators, dispatch)
}
export default withRouter(connect(mapStateToProps, mapDispatchToProps)(Profile))
